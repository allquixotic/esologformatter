import { CHAT_CHANNELS } from '../channels'
import type { ChatLine } from '../types'
import { formatTimestamp, type TimeFormat } from './time'

export interface PlainOptions {
  timeFormat: TimeFormat
  /** Display label per channel (base name or user alias). */
  labels: Readonly<Record<number, string>>
}

/**
 * Chat-style plain text, ported from the original site's renderer:
 * channel-specific speaker prefixes, optional `[time]` prefix, one line per message.
 */
export function renderPlain(lines: readonly ChatLine[], opts: PlainOptions): string {
  const out: string[] = []
  for (const line of lines) {
    let text = ''
    const tv = formatTimestamp(line.timestamp, opts.timeFormat)
    if (tv !== '') {
      text += `[${tv}] `
    }

    const baseName = CHAT_CHANNELS[line.channel]
    const label = opts.labels[line.channel] ?? baseName ?? `Channel ${line.channel}`
    switch (baseName) {
      case 'Say':
        text += `${line.from}: `
        break
      case 'Emote':
        text += `${line.from} `
        break
      case 'Yell':
        text += `${line.from} yells `
        break
      case 'Whisper':
        text += `${line.from} whispers: `
        break
      case 'Outgoing Whisper':
        text += `-> ${line.from}: `
        break
      default:
        text += `[${label}] ${line.from}: `
        break
    }

    text += line.message
    out.push(text)
  }
  return out.join('\n') + (out.length > 0 ? '\n' : '')
}
