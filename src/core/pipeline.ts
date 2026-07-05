import { buildNarrative } from './narrative'
import { sortByTimestamp } from './parser'
import { renderPlain } from './formats/plain'
import { renderTableDocument } from './formats/table'
import type { TimeFormat } from './formats/time'
import type { ChatLine } from './types'

export type OutputFormat = 'plain' | 'narrative' | 'table'

export interface DateWindowMs {
  startMs: number
  endMs: number
}

export interface PipelineOptions {
  format: OutputFormat
  /** Inclusive epoch-ms window, or null for "everything". */
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

/** Filter, order, and render parsed lines into the selected output format. */
export function runPipeline(lines: readonly ChatLine[], opts: PipelineOptions): string {
  let selected: ChatLine[] = opts.window
    ? lines.filter((l) => l.epochMs >= opts.window!.startMs && l.epochMs <= opts.window!.endMs)
    : [...lines]

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
