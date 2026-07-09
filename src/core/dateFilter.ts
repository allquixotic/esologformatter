import { DateTime } from 'luxon'
import type { DateWindowMs } from './pipeline'
import { validateDurationHours, type PresetDefinition } from './presets'
import { calculateEventWindow, effectiveWeeksAgo } from './schedule'
import {
  isValidTimeZone,
  projectWindowToLogTime,
  resolveCustomTimeWindow,
  TimeZoneResolutionError,
  type ResolvedTimeWindow,
} from './timezones'

export type DateFilterMode = 'all' | 'preset' | 'custom'

export interface DateFilterRequest {
  mode: DateFilterMode
  logTimezone: string
  preset?: PresetDefinition
  presetName?: string
  weeksAgo?: number
  durationOverrideEnabled?: boolean
  durationOverrideHours?: number
  customStart?: string
  customEnd?: string
  customRangeTimezone?: string
  /** Injectable current instant for deterministic tests. */
  today?: DateTime
}

export interface ResolvedDateFilter {
  mode: DateFilterMode
  window: DateWindowMs | null
  zonedWindow: ResolvedTimeWindow | null
  fileDate?: string
  filePrefix?: string
}

export interface ResolvedTimeWindowText {
  sourceRange: string
  rawLogRange: string
}

function formatRange(start: DateTime, end: DateTime): string {
  return `${start.toFormat('ccc yyyy-MM-dd HH:mm')} → ${end.toFormat('ccc yyyy-MM-dd HH:mm')}`
}

/** Shared UI/runner text derived from the same resolved object as pipeline bounds. */
export function formatResolvedTimeWindow(window: ResolvedTimeWindow): ResolvedTimeWindowText {
  return {
    sourceRange: `${formatRange(window.sourceStart, window.sourceEnd)} (${window.sourceTimezone})`,
    rawLogRange: `${formatRange(window.logStart, window.logEnd)} (${window.logTimezone})`,
  }
}

/** Resolve date-filter settings once for both preview and processing. */
export function resolveDateFilter(request: DateFilterRequest): ResolvedDateFilter {
  if (!isValidTimeZone(request.logTimezone)) {
    throw new TimeZoneResolutionError(
      `Unknown log-recording timezone "${request.logTimezone}".`,
    )
  }

  if (request.mode === 'all') {
    return { mode: 'all', window: null, zonedWindow: null }
  }

  let zonedWindow: ResolvedTimeWindow
  let fileDate: string | undefined
  let filePrefix: string | undefined

  if (request.mode === 'preset') {
    if (!request.preset) {
      throw new TimeZoneResolutionError(`Preset "${request.presetName ?? ''}" not found.`)
    }
    let durationMinutes: number | undefined
    if (request.durationOverrideEnabled) {
      const durationHours = request.durationOverrideHours ?? Number.NaN
      const problem = validateDurationHours(durationHours)
      if (problem) throw new TimeZoneResolutionError(problem)
      durationMinutes = Math.round(durationHours * 60)
    }
    const weeks = effectiveWeeksAgo(request.weeksAgo ?? 0, request.preset)
    const eventWindow = calculateEventWindow(
      request.preset,
      weeks,
      durationMinutes,
      request.today,
    )
    zonedWindow = projectWindowToLogTime(
      eventWindow.start,
      eventWindow.end,
      request.logTimezone,
    )
    fileDate = eventWindow.fileDate
    filePrefix = request.preset.filePrefix
  } else {
    zonedWindow = resolveCustomTimeWindow(
      request.customStart ?? '',
      request.customEnd ?? '',
      request.customRangeTimezone ?? '',
      request.logTimezone,
    )
  }

  return {
    mode: request.mode,
    window: { startMs: zonedWindow.startMs, endMs: zonedWindow.endMs },
    zonedWindow,
    fileDate,
    filePrefix,
  }
}
