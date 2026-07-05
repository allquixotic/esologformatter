// Event window calculation ported from rconv-core/src/runtime.rs
// (calculate_dates_for_event / find_weekday_occurrence / calculate_event_times),
// generalized to any PresetDefinition and implemented with Luxon so the
// preset's IANA timezone (and DST transitions) are handled correctly.

import { DateTime } from 'luxon'
import type { PresetDefinition, Weekday } from './presets'

const WEEKDAY_NUM: Record<Weekday, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

export interface EventWindow {
  /** Event start in the preset's timezone. */
  start: DateTime
  /** Event end in the preset's timezone. */
  end: DateTime
  /** Inclusive epoch-ms bounds for filtering parsed lines. */
  startMs: number
  endMs: number
  /** `MMDDYY` of the event date, for output file naming. */
  fileDate: string
}

/**
 * Find the most recent occurrence of the preset weekday (today counts when it
 * matches), go back `weeksAgo` additional weeks, and place the start time in
 * the preset's timezone.
 */
export function calculateEventWindow(
  preset: PresetDefinition,
  weeksAgo: number,
  durationMinutesOverride?: number,
  today: DateTime = DateTime.local(),
): EventWindow {
  const target = WEEKDAY_NUM[preset.weekday]
  const todayNum = today.weekday // 1 = Monday .. 7 = Sunday
  const daysSince = todayNum >= target ? todayNum - target : 7 - (target - todayNum)
  const eventDate = today.minus({ days: daysSince, weeks: weeksAgo })

  const [hourStr, minuteStr] = preset.startTime.split(':')
  const start = DateTime.fromObject(
    {
      year: eventDate.year,
      month: eventDate.month,
      day: eventDate.day,
      hour: Number(hourStr),
      minute: Number(minuteStr),
    },
    { zone: preset.timezone },
  )

  const durationMinutes = durationMinutesOverride ?? preset.durationMinutes
  const end = start.plus({ minutes: durationMinutes })

  return {
    start,
    end,
    startMs: start.toMillis(),
    endMs: end.toMillis(),
    fileDate: eventDate.toFormat('MMddyy'),
  }
}

/** Effective weeks-ago: rconv uses the preset default when the user selection is 0. */
export function effectiveWeeksAgo(userWeeksAgo: number, preset: PresetDefinition): number {
  return userWeeksAgo === 0 ? preset.defaultWeeksAgo : userWeeksAgo
}
