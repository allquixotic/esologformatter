import { describe, expect, test } from 'bun:test'
import { DateTime } from 'luxon'
import { parseChatLog } from '../src/core/parser'
import { runPipeline, type PipelineOptions } from '../src/core/pipeline'
import { builtinPresets, FRIDAY_6_PRESET_NAME } from '../src/core/presets'
import { calculateEventWindow, wallClockMs } from '../src/core/schedule'

const BASE_OPTS: Omit<PipelineOptions, 'window'> = {
  format: 'plain',
  sortByTime: false,
  cleanup: true,
  timeFormat: 'none',
  channelEnabled: () => true,
  labels: { 3: 'Group', 6: 'Emote', 14: 'Guild 3' },
}

describe('runPipeline date-window filtering', () => {
  // Regression: ESO stamps ChatLog.log with a fixed -05:00 offset all year.
  // During EDT (-04:00) trusting the offset shifted events one hour out of
  // the preset window and "No log data found" was reported despite matching
  // wall-clock lines. rconv compares naive wall-clock strings instead.
  test('matches wall-clock time even when the written offset is stale', () => {
    const log =
      '2026-07-03T17:59:59.000-05:00 3,Early,before the window\n' +
      '2026-07-03T18:01:46.796-05:00 3,Coorbin,we will get started\n' +
      '2026-07-03T18:59:00.000-05:00 6,Ankriston Fernhollow,zooms in\n' +
      '2026-07-03T19:00:30.000-05:00 3,Boundary,end minute is inclusive\n' +
      '2026-07-03T19:01:00.000-05:00 3,Late,after the window\n'
    const lines = parseChatLog(log, 'ChatLog.log')

    const tp6 = builtinPresets().find((p) => p.name === FRIDAY_6_PRESET_NAME)!
    const today = DateTime.fromISO('2026-07-04T22:00:00', { zone: 'America/New_York' })
    const w = calculateEventWindow(tp6, 0, undefined, today)
    expect(w.fileDate).toBe('070326')

    const out = runPipeline(lines, {
      ...BASE_OPTS,
      window: {
        startMs: wallClockMs(w.start, 'America/New_York'),
        endMs: wallClockMs(w.end, 'America/New_York'),
      },
    })

    expect(out).toContain('we will get started')
    expect(out).toContain('zooms in')
    expect(out).toContain('end minute is inclusive') // rconv end bound is inclusive
    expect(out).not.toContain('before the window')
    expect(out).not.toContain('after the window')
  })

  test('null window keeps everything', () => {
    const log =
      '2026-01-01T00:00:00.000-05:00 3,A,one\n' + '2026-06-01T12:00:00.000-05:00 3,B,two\n'
    const out = runPipeline(parseChatLog(log, 'a.log'), { ...BASE_OPTS, window: null })
    expect(out).toContain('one')
    expect(out).toContain('two')
  })
})
