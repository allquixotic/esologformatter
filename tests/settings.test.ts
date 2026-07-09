import { describe, expect, test } from 'bun:test'
import { mergeStoredSettings } from '../src/stores/settings'

describe('settings timezone migration', () => {
  test('V6_MissingZonesDefaultToDetectedBrowserZone', () => {
    const settings = mergeStoredSettings(
      {
        theme: 'light',
        dateMode: 'custom',
        customStart: '2026-07-03T17:00',
        customEnd: '2026-07-03T18:00',
      },
      'America/Chicago',
    )

    expect(settings.theme).toBe('light')
    expect(settings.customStart).toBe('2026-07-03T17:00')
    expect(settings.logTimezone).toBe('America/Chicago')
    expect(settings.customRangeTimezone).toBe('America/Chicago')
  })

  test('V6_ExplicitSavedZonesSurviveMigration', () => {
    const settings = mergeStoredSettings(
      {
        logTimezone: 'America/Denver',
        customRangeTimezone: 'America/New_York',
      },
      'America/Chicago',
    )

    expect(settings.logTimezone).toBe('America/Denver')
    expect(settings.customRangeTimezone).toBe('America/New_York')
  })
})
