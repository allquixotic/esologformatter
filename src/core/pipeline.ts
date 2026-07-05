import { buildNarrative } from './narrative'
import { sortByTimestamp } from './parser'
import { renderPlain } from './formats/plain'
import { renderTableDocument } from './formats/table'
import type { TimeFormat } from './formats/time'
import type { ChatLine } from './types'

export type OutputFormat = 'plain' | 'narrative' | 'table'

export interface DateWindowMs {
  /** Inclusive wall-clock bounds (see schedule.wallClockMs), minute precision. */
  startMs: number
  endMs: number
}

export interface PipelineOptions {
  format: OutputFormat
  /** Inclusive wall-clock window, or null for "everything". */
  window: DateWindowMs | null
  sortByTime: boolean
  /** rconv-style cleanup (narrative mode only). */
  cleanup: boolean
  timeFormat: TimeFormat
  /** Channels to include for plain/table output (narrative is fixed to say+emote). */
  channelEnabled: (channel: number) => boolean
  labels: Readonly<Record<number, string>>
  title?: string
}

const toMinute = (ms: number): number => Math.floor(ms / 60_000) * 60_000

/** Filter, order, and render parsed lines into the selected output format. */
export function runPipeline(lines: readonly ChatLine[], opts: PipelineOptions): string {
  let selected: ChatLine[]
  if (opts.window) {
    // rconv parity: compare wall-clock minutes, inclusive on both ends. The
    // offsets written in ESO logs are unreliable (fixed year-round), so real
    // epoch comparison would shift events by the DST difference.
    const startMin = toMinute(opts.window.startMs)
    const endMin = toMinute(opts.window.endMs)
    selected = lines.filter((l) => {
      const minute = toMinute(l.wallMs)
      return minute >= startMin && minute <= endMin
    })
  } else {
    selected = [...lines]
  }

  if (opts.sortByTime) {
    selected = sortByTimestamp(selected)
  }

  switch (opts.format) {
    case 'narrative':
      return buildNarrative(selected, { cleanup: opts.cleanup })
    case 'plain':
      return renderPlain(
        selected.filter((l) => opts.channelEnabled(l.channel)),
        { timeFormat: opts.timeFormat, labels: opts.labels },
      )
    case 'table':
      return renderTableDocument(
        selected.filter((l) => opts.channelEnabled(l.channel)),
        { timeFormat: opts.timeFormat, labels: opts.labels, title: opts.title },
      )
  }
}
