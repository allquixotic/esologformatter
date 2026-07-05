import { DateTime } from 'luxon'
import type { ChatLine, InputFile } from './types'

/**
 * One log line: `2019-02-17T15:38:15.052-05:00 6,Some Name,does a thing`.
 * Same shape the original site matched, applied per line.
 */
const LINE_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}) (\d{1,2}),([^,]+),(.*)$/

export function parseChatLog(text: string, fileName: string, startIndex = 0): ChatLine[] {
  const out: ChatLine[] = []
  let index = startIndex
  for (const row of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = LINE_RE.exec(row)
    if (!m) {
      continue
    }
    const [, timestamp, channel, from, message] = m
    const dt = DateTime.fromISO(timestamp!, { setZone: true })
    if (!dt.isValid) {
      continue
    }
    out.push({
      timestamp: timestamp!,
      epochMs: dt.toMillis(),
      channel: Number(channel),
      from: from!,
      message: message!,
      file: fileName,
      index: index++,
    })
  }
  return out
}

/** Parse several files, preserving file order and assigning a global ordering index. */
export function parseFiles(files: InputFile[]): ChatLine[] {
  const all: ChatLine[] = []
  for (const file of files) {
    // No spread here: spreading a large log's lines as call arguments blows
    // the engine argument limit ("Maximum call stack size exceeded").
    for (const line of parseChatLog(file.text, file.name, all.length)) {
      all.push(line)
    }
  }
  return all
}

/** Stable sort by timestamp (ties keep original order). Returns a new array. */
export function sortByTimestamp(lines: readonly ChatLine[]): ChatLine[] {
  return [...lines].sort((a, b) => a.epochMs - b.epochMs || a.index - b.index)
}

/** Group lines by channel, e.g. for channel discovery UI. */
export function groupByChannel(lines: readonly ChatLine[]): Map<number, ChatLine[]> {
  const groups = new Map<number, ChatLine[]>()
  for (const line of lines) {
    const bucket = groups.get(line.channel)
    if (bucket) {
      bucket.push(line)
    } else {
      groups.set(line.channel, [line])
    }
  }
  return groups
}
