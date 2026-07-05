import { describe, expect, test } from 'bun:test'
import { DateTime } from 'luxon'
import {
  builtinPresets,
  FRIDAY_6_PRESET_NAME,
  SATURDAY_PRESET_NAME,
  TUESDAY_7_PRESET_NAME,
  type PresetDefinition,
} from '../src/core/presets'
import { calculateEventWindow, effectiveWeeksAgo, wallClockMs } from '../src/core/schedule'

function preset(name: string): PresetDefinition {
  const found = builtinPresets().find((p) => p.name === name)
  if (!found) throw new Error(`missing preset ${name}`)
  return found
}

// Thursday, matching rconv's tests.
const TODAY = DateTime.fromISO('2025-10-16T12:00:00', { zone: 'America/New_York' })

describe('calculateEventWindow', () => {
  test('most recent Saturday (rconv: 101125)', () => {
    const w = calculateEventWindow(preset(SATURDAY_PRESET_NAME), 0, undefined, TODAY)
    expect(w.fileDate).toBe('101125')
    expect(w.start.hour).toBe(22)
    expect(w.start.zoneName).toBe('America/New_York')
  })

  test('one week ago Saturday (rconv: 100425)', () => {
    const w = calculateEventWindow(preset(SATURDAY_PRESET_NAME), 1, undefined, TODAY)
    expect(w.fileDate).toBe('100425')
  })

  test('most recent Tuesday for rsm7 (rconv: 101425)', () => {
    const w = calculateEventWindow(preset(TUESDAY_7_PRESET_NAME), 0, undefined, TODAY)
    expect(w.fileDate).toBe('101425')
    expect(w.start.hour).toBe(19)
  })

  test('most recent Friday for tp6 (rconv find_weekday_occurrence: 2025-10-10)', () => {
    const w = calculateEventWindow(preset(FRIDAY_6_PRESET_NAME), 0, undefined, TODAY)
    expect(w.fileDate).toBe('101025')
    expect(w.start.hour).toBe(18)
  })

  test('event day counts as most recent occurrence', () => {
    const tuesday = DateTime.fromISO('2025-10-14T12:00:00', { zone: 'America/New_York' })
    const w = calculateEventWindow(preset(TUESDAY_7_PRESET_NAME), 0, undefined, tuesday)
    expect(w.fileDate).toBe('101425')
  })

  test('saturday window is exactly 145 minutes', () => {
    const w = calculateEventWindow(preset(SATURDAY_PRESET_NAME), 0, undefined, TODAY)
    expect(w.endMs - w.startMs).toBe(145 * 60_000)
  })

  test('duration override wins', () => {
    const w = calculateEventWindow(preset(SATURDAY_PRESET_NAME), 0, 90, TODAY)
    expect(w.endMs - w.startMs).toBe(90 * 60_000)
  })

  test('window spanning the DST fall-back keeps wall-clock duration in ms', () => {
    // Saturday 2025-11-01 22:00 EDT; US fall-back is 2025-11-02 02:00.
    const thursday = DateTime.fromISO('2025-11-06T12:00:00', { zone: 'America/New_York' })
    const w = calculateEventWindow(preset(SATURDAY_PRESET_NAME), 0, undefined, thursday)
    expect(w.fileDate).toBe('110125')
    expect(w.start.offset).toBe(-4 * 60) // still EDT
    expect(w.endMs - w.startMs).toBe(145 * 60_000)
  })
})

describe('wallClockMs', () => {
  // Saturday evening ET; most recent tp6 Friday is 2026-07-03 (EDT period).
  const today = DateTime.fromISO('2026-07-04T22:00:00', { zone: 'America/New_York' })
  const w = calculateEventWindow(preset(FRIDAY_6_PRESET_NAME), 0, undefined, today)

  test('same zone keeps the wall-clock components', () => {
    expect(w.fileDate).toBe('070326')
    expect(wallClockMs(w.start, 'America/New_York')).toBe(Date.UTC(2026, 6, 3, 18, 0))
  })

  test('viewer in a different zone gets that zone\u2019s wall clock', () => {
    expect(wallClockMs(w.start, 'America/Los_Angeles')).toBe(Date.UTC(2026, 6, 3, 15, 0))
  })
})

describe('effectiveWeeksAgo', () => {
  const p: PresetDefinition = { ...preset(SATURDAY_PRESET_NAME), defaultWeeksAgo: 2 }
  test('uses preset default when selection is 0', () => {
    expect(effectiveWeeksAgo(0, p)).toBe(2)
  })
  test('explicit selection wins', () => {
    expect(effectiveWeeksAgo(3, p)).toBe(3)
  })
})
