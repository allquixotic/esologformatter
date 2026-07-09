import { describe, expect, test } from 'bun:test'
import { DateTime } from 'luxon'
import { resolveDateFilter, formatResolvedTimeWindow } from '../src/core/dateFilter'
import { builtinPresets, FRIDAY_6_PRESET_NAME, TUESDAY_7_PRESET_NAME } from '../src/core/presets'

function preset(name: string) {
  return builtinPresets().find((candidate) => candidate.name === name)!
}

describe('shared date-filter resolver', () => {
  test('V3_SharedResolverProducesDisplayedAndAppliedBounds', () => {
    const resolved = resolveDateFilter({
      mode: 'preset',
      logTimezone: 'America/Chicago',
      preset: preset(FRIDAY_6_PRESET_NAME),
      presetName: FRIDAY_6_PRESET_NAME,
      weeksAgo: 0,
      durationOverrideEnabled: false,
      durationOverrideHours: 1,
      today: DateTime.fromISO('2026-07-04T12:00', { zone: 'America/Chicago' }),
    })

    expect(resolved.zonedWindow).not.toBeNull()
    expect(resolved.window).toEqual({
      startMs: resolved.zonedWindow!.startMs,
      endMs: resolved.zonedWindow!.endMs,
    })
    expect(formatResolvedTimeWindow(resolved.zonedWindow!).rawLogRange).toBe(
      'Fri 2026-07-03 17:00 → Fri 2026-07-03 18:00 (America/Chicago)',
    )
    expect(resolved.fileDate).toBe('070326')
  })

  test('V1_EventDateUsesEventTimezone', () => {
    const resolved = resolveDateFilter({
      mode: 'preset',
      logTimezone: 'America/Chicago',
      preset: preset(TUESDAY_7_PRESET_NAME),
      presetName: TUESDAY_7_PRESET_NAME,
      weeksAgo: 0,
      durationOverrideEnabled: false,
      durationOverrideHours: 1,
      // Monday in Chicago, already Tuesday in New York.
      today: DateTime.fromISO('2026-07-06T23:30', { zone: 'America/Chicago' }),
    })

    expect(resolved.fileDate).toBe('070726')
    expect(resolved.zonedWindow!.sourceStart.weekday).toBe(2)
  })

  test('V4_AllModeStillRejectsInvalidLogZone', () => {
    expect(() => resolveDateFilter({ mode: 'all', logTimezone: 'Mars/Olympus' })).toThrow(
      'Unknown log-recording timezone "Mars/Olympus".',
    )
  })
})
