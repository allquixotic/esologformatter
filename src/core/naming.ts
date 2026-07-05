// Output filename rules ported from rconv-core/src/runtime.rs
// (derive_default_outfile / sanitize_for_filename / get_unedited_filename).

import type { OutputFormat } from './pipeline'

export function sanitizeForFilename(value: string): string {
  return value.replaceAll(':', '-').replaceAll('T', '_')
}

export interface NamingContext {
  dateMode: 'all' | 'preset' | 'custom'
  format: OutputFormat
  /** Preset file prefix (preset mode). */
  filePrefix?: string
  /** `MMDDYY` event date (preset mode). */
  fileDate?: string
  /** `YYYY-MM-DDTHH:MM`-style bounds (custom mode). */
  startIso?: string
  endIso?: string
}

function extensionFor(format: OutputFormat): string {
  return format === 'table' ? '.html' : '.txt'
}

/** Default output filename for the current run. */
export function defaultOutputName(ctx: NamingContext): string {
  const ext = extensionFor(ctx.format)
  if (ctx.dateMode === 'preset' && ctx.filePrefix && ctx.fileDate) {
    return `${ctx.filePrefix.trim()}-${ctx.fileDate}${ext}`
  }
  if (ctx.dateMode === 'custom' && (ctx.startIso || ctx.endIso)) {
    const start = sanitizeForFilename(ctx.startIso ?? 'start')
    const end = sanitizeForFilename(ctx.endIso ?? 'end')
    return `event-${start}-${end}${ext}`
  }
  return `processed-output${ext}`
}

/** Sibling filename holding the pre-AI text (rconv `_unedited`). */
export function uneditedName(outfile: string): string {
  const dot = outfile.lastIndexOf('.')
  const stem = dot > 0 ? outfile.slice(0, dot) : outfile
  return `${stem}_unedited.txt`
}
