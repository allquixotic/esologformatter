// Faithful TypeScript port of the say/emote "narrative" pipeline from
// rconv-core/src/runtime.rs (process_filtered_file / process_log_file):
// multi-line continuation smashing (`>` / `+`), end punctuation, and
// dialogue formatting.

import { CHANNEL_EMOTE, CHANNEL_SAY } from './channels'
import {
  ensureEndPunc,
  isEncapsulated,
  isQuote,
  isQuoted,
  normalizePunctuation,
  stripInlineOoc,
} from './cleanup'
import type { ChatLine } from './types'

export interface NarrativeOptions {
  /** Apply OOC removal + punctuation normalization + end-punctuation (rconv `cleanup`). */
  cleanup: boolean
}

interface Pending {
  msgid: number
  value: string
  firstChannel: number
  name: string
}

/** rconv `smash`: merge a continuation line into a pending multi-line message. */
function smash(entry: Pending, newMsg: string): void {
  entry.value = entry.value.replace(/[+>]/g, '').trimEnd()
  const last = entry.value.charAt(entry.value.length - 1)
  if (last !== '' && isQuote(last)) {
    entry.value = entry.value.slice(0, -1)
  }

  let nm = newMsg
  const nmFirst = nm.charAt(0)
  if (nmFirst !== '' && isQuote(nmFirst)) {
    nm = nm.slice(1)
  }

  if (entry.value.length > 0) {
    entry.value += ' '
  }
  entry.value += nm

  const first = entry.value.charAt(0)
  if (first !== '' && isQuote(first)) {
    const l = entry.value.charAt(entry.value.length - 1)
    if (l !== '' && !isQuote(l)) {
      entry.value += first
    }
  }
}

/** rconv `fmt_start`: format one finished message as narrative dialogue (ends with `\n`). */
export function fmtStart(name: string, value: string, firstChannel: number): string {
  let mmsg = ''
  if (firstChannel === CHANNEL_SAY) {
    mmsg = isQuoted(value) ? `${name} says, ${value}` : `${name} says, "${value}"`
  } else if (firstChannel === CHANNEL_EMOTE) {
    mmsg = isQuoted(value) ? `${name} says, ${value}` : `${name} ${value}`
  }
  return mmsg.replace(/\s+/g, ' ').trim() + '\n'
}

/**
 * Convert say/emote lines into clean narrative text.
 * Other channels are ignored, matching rconv.
 */
export function buildNarrative(
  lines: readonly ChatLine[],
  options: NarrativeOptions = { cleanup: true },
): string {
  const inProgress = new Map<string, Pending>()
  const output: string[] = []

  for (const line of lines) {
    if (line.channel !== CHANNEL_SAY && line.channel !== CHANNEL_EMOTE) {
      continue
    }

    let msg = line.message
    if (options.cleanup) {
      if (isEncapsulated(msg)) {
        continue
      }
      msg = normalizePunctuation(msg)
      msg = stripInlineOoc(msg)
    }

    if (msg.endsWith('>') || msg.endsWith('+')) {
      const existing = inProgress.get(line.from)
      if (!existing) {
        inProgress.set(line.from, {
          msgid: output.length,
          value: msg,
          firstChannel: line.channel,
          name: line.from,
        })
      } else {
        smash(existing, msg)
      }
      continue
    }

    const pending = inProgress.get(line.from)
    if (pending) {
      // Final line in a series for this speaker.
      smash(pending, msg)
      pending.value = ensureEndPunc(pending.value)
      const formatted = fmtStart(pending.name, pending.value, pending.firstChannel).replaceAll('""', '"')
      output.splice(Math.min(pending.msgid, output.length), 0, formatted)
      inProgress.delete(line.from)
      continue
    }

    // Single-line message.
    if (options.cleanup) {
      msg = ensureEndPunc(msg)
    }
    output.push(fmtStart(line.from, msg, line.channel).replaceAll('""', '"'))
  }

  // Drain any remaining pending entries in ascending msgid order.
  const drained = [...inProgress.values()].sort((a, b) => a.msgid - b.msgid)
  for (const entry of drained) {
    const formatted = fmtStart(entry.name, entry.value, entry.firstChannel).replaceAll('""', '"')
    output.splice(Math.min(entry.msgid, output.length), 0, formatted)
  }

  return output.join('')
}
