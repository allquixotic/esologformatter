import { describe, expect, test } from 'bun:test'
import { DateTime } from 'luxon'
import { parseChatLog } from '../src/core/parser'
import { runPipeline, type PipelineOptions } from '../src/core/pipeline'
import {
  projectWindowToLogTime,
  resolveCustomTimeWindow,
  TimeZoneResolutionError,
} from '../src/core/timezones'

const BASE_OPTS: Omit<PipelineOptions, 'window'> = {
  format: 'plain',
  sortByTime: false,
  cleanup: true,
  timeFormat: 'none',
  channelEnabled: () => true,
  labels: {},
}

describe('explicit timezone resolution', () => {
  test('V1_ExplicitLogZoneIgnoresBrowserZone', () => {
    const eventStart = DateTime.fromISO('2026-07-03T18:00', {
      zone: 'America/New_York',
    })
    const resolved = projectWindowToLogTime(
      eventStart,
      eventStart.plus({ minutes: 60 }),
      'America/Chicago',
    )

    expect(resolved.sourceTimezone).toBe('America/New_York')
    expect(resolved.logTimezone).toBe('America/Chicago')
    expect(resolved.logStart.toFormat("yyyy-MM-dd'T'HH:mm")).toBe('2026-07-03T17:00')
    expect(resolved.logEnd.toFormat("yyyy-MM-dd'T'HH:mm")).toBe('2026-07-03T18:00')
    expect(resolved.startMs).toBe(Date.UTC(2026, 6, 3, 17, 0))
    expect(resolved.endMs).toBe(Date.UTC(2026, 6, 3, 18, 0))
  })

  test('V2_CustomRangeConvertsSourceToLogZone', () => {
    const resolved = resolveCustomTimeWindow(
      '2026-07-03T18:00',
      '2026-07-03T19:15',
      'America/New_York',
      'America/Chicago',
    )

    expect(resolved.logStart.toFormat("yyyy-MM-dd'T'HH:mm")).toBe('2026-07-03T17:00')
    expect(resolved.logEnd.toFormat("yyyy-MM-dd'T'HH:mm")).toBe('2026-07-03T18:15')
  })

  test('V4_InvalidZoneAndRangeRejected', () => {
    const eventStart = DateTime.fromISO('2026-07-03T18:00', {
      zone: 'America/New_York',
    })

    expect(() =>
      projectWindowToLogTime(eventStart, eventStart.plus({ hours: 1 }), 'Mars/Olympus'),
    ).toThrow(TimeZoneResolutionError)
    expect(() =>
      resolveCustomTimeWindow(
        '2026-07-03T18:00',
        '2026-07-03T17:00',
        'America/New_York',
        'America/Chicago',
      ),
    ).toThrow('Custom range end must be after its start.')
    expect(() =>
      resolveCustomTimeWindow(
        'not-a-date',
        '2026-07-03T19:00',
        'America/New_York',
        'America/Chicago',
      ),
    ).toThrow('Custom date range requires valid start and end times.')
  })

  test('V8_EasternEventCentralLogKeepsFullWindow', () => {
    const rows: string[] = []
    for (let minute = 0; minute <= 75; minute++) {
      const hour = 17 + Math.floor(minute / 60)
      const minuteOfHour = minute % 60
      rows.push(
        `2026-07-03T${String(hour).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}:00.000-05:00 0,A,line-${minute}`,
      )
    }

    const resolved = resolveCustomTimeWindow(
      '2026-07-03T18:00',
      '2026-07-03T19:15',
      'America/New_York',
      'America/Chicago',
    )
    const output = runPipeline(parseChatLog(rows.join('\n'), 'Central.log'), {
      ...BASE_OPTS,
      window: { startMs: resolved.startMs, endMs: resolved.endMs },
    })

    const outputLines = output.trim().split('\n')
    expect(outputLines).toHaveLength(76)
    expect(outputLines[0]).toContain('line-0')
    expect(outputLines.at(-1)).toContain('line-75')
  })
})
