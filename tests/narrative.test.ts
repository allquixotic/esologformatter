import { describe, expect, test } from 'bun:test'
import { buildNarrative } from '../src/core/narrative'
import { parseChatLog } from '../src/core/parser'

function narr(log: string, cleanup = true): string {
  return buildNarrative(parseChatLog(log, 'ChatLog.log'), { cleanup })
}

describe('buildNarrative', () => {
  test('formats say and emote like rconv pipeline fixture', () => {
    const log =
      '2025-01-04T22:00:00.000-05:00 0,Character One,Hello there\n' +
      '2025-01-04T22:01:15.125-05:00 6,Character Two,gestures gracefully\n'
    expect(narr(log)).toBe(
      'Character One says, "Hello there."\nCharacter Two gestures gracefully.\n',
    )
  })

  test('ignores non say/emote channels', () => {
    const log =
      '2025-01-04T22:00:00.000-05:00 3,Party Person,secret plans\n' +
      '2025-01-04T22:00:01.000-05:00 11,System,You gained XP\n' +
      '2025-01-04T22:00:02.000-05:00 0,Alice,Onward.\n'
    expect(narr(log)).toBe('Alice says, "Onward."\n')
  })

  test('smashes multi-line continuations marked with > and preserves quoting', () => {
    const log =
      '2025-01-04T22:00:00.000-05:00 0,Alice,"I walk the path >\n' +
      '2025-01-04T22:00:05.000-05:00 0,Alice,and it ends here."\n'
    expect(narr(log)).toBe('Alice says, "I walk the path and it ends here."\n')
  })

  test('inserts completed multi-line message at its original position', () => {
    const log =
      '2025-01-04T22:00:00.000-05:00 0,Alice,"Start of something >\n' +
      '2025-01-04T22:00:01.000-05:00 0,Bob,Interjection!\n' +
      '2025-01-04T22:00:02.000-05:00 0,Alice,that finishes now."\n'
    expect(narr(log)).toBe(
      'Alice says, "Start of something that finishes now."\nBob says, "Interjection!"\n',
    )
  })

  test('drops fully encapsulated OOC lines and strips inline OOC', () => {
    const log =
      '2025-01-04T22:00:00.000-05:00 0,Alice,((brb phone))\n' +
      '2025-01-04T22:00:01.000-05:00 0,Alice,Hello ((ooc aside)) friend\n'
    expect(narr(log)).toBe('Alice says, "Hello friend."\n')
  })

  test('normalizes smart quotes and ellipsis', () => {
    const log = '2025-01-04T22:00:00.000-05:00 0,Alice,\u201cGreetings\u2026\u201d\n'
    expect(narr(log)).toBe('Alice says, "Greetings..."\n')
  })

  test('quoted emote is rendered as says', () => {
    const log = '2025-01-04T22:00:00.000-05:00 6,Char,"Indeed."\n'
    expect(narr(log)).toBe('Char says, "Indeed."\n')
  })

  test('drains unterminated continuations at end of input', () => {
    const log = '2025-01-04T22:00:00.000-05:00 0,Alice,"Trails off >\n'
    expect(narr(log)).toBe('Alice says, "Trails off >"\n')
  })

  test('cleanup=false keeps OOC and skips end punctuation on single lines', () => {
    const log = '2025-01-04T22:00:00.000-05:00 0,Alice,hello there ((ooc))\n'
    expect(narr(log, false)).toBe('Alice says, "hello there ((ooc))"\n')
  })
})
