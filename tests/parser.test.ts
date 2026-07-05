import { describe, expect, test } from 'bun:test'
import { parseChatLog, parseFiles, sortByTimestamp } from '../src/core/parser'

describe('parseChatLog', () => {
  test('parses timestamp, channel, sender, and message with commas', () => {
    const log = '2025-01-04T22:00:00.000-05:00 0,Character One,Hello, my friend, and welcome\n'
    const lines = parseChatLog(log, 'a.log')
    expect(lines).toHaveLength(1)
    expect(lines[0]!.channel).toBe(0)
    expect(lines[0]!.from).toBe('Character One')
    expect(lines[0]!.message).toBe('Hello, my friend, and welcome')
    // 22:00 -05:00 === 03:00 UTC the next day.
    expect(lines[0]!.epochMs).toBe(Date.UTC(2025, 0, 5, 3, 0, 0, 0))
  })

  test('handles CRLF and skips non-matching lines', () => {
    const log =
      'garbage line\r\n' +
      '2025-01-04T22:00:00.000+01:00 6,Char,waves\r\n' +
      'also garbage\r\n'
    const lines = parseChatLog(log, 'b.log')
    expect(lines).toHaveLength(1)
    expect(lines[0]!.message).toBe('waves')
  })

  test('parseFiles assigns a global order and sortByTimestamp is stable', () => {
    const fileA = { name: 'a.log', text: '2025-01-04T22:05:00.000-05:00 0,A,later\n' }
    const fileB = {
      name: 'b.log',
      text:
        '2025-01-04T22:00:00.000-05:00 0,B,earlier\n' +
        '2025-01-04T22:05:00.000-05:00 0,B,tie goes to first file? no — original order\n',
    }
    const lines = parseFiles([fileA, fileB])
    expect(lines.map((l) => l.index)).toEqual([0, 1, 2])

    const sorted = sortByTimestamp(lines)
    expect(sorted.map((l) => l.from)).toEqual(['B', 'A', 'B'])
  })
})
