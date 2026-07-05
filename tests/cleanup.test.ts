import { describe, expect, test } from 'bun:test'
import {
  endsWithPunctuation,
  ensureEndPunc,
  isEncapsulated,
  isQuoted,
  normalizePunctuation,
  stripInlineOoc,
} from '../src/core/cleanup'

describe('cleanup helpers', () => {
  test('ensureEndPunc appends period', () => {
    expect(ensureEndPunc('Hello')).toBe('Hello.')
  })

  test('ensureEndPunc inserts before trailing quote', () => {
    expect(ensureEndPunc('He said "hi"')).toBe('He said "hi."')
  })

  test('ensureEndPunc leaves punctuated text alone', () => {
    expect(ensureEndPunc('Ready?')).toBe('Ready?')
    expect(ensureEndPunc('Done!')).toBe('Done!')
    expect(ensureEndPunc('Wait...')).toBe('Wait...')
  })

  test('endsWithPunctuation ignores continuation markers and quotes', () => {
    expect(endsWithPunctuation('She smiled. >')).toBe(true)
    expect(endsWithPunctuation('She smiled >')).toBe(false)
    expect(endsWithPunctuation('"Done." ')).toBe(true)
  })

  test('isQuoted', () => {
    expect(isQuoted('"Hello."')).toBe(true)
    expect(isQuoted('"Hello there"')).toBe(true)
    expect(isQuoted('Hello')).toBe(false)
    expect(isQuoted('')).toBe(false)
  })

  test('isEncapsulated', () => {
    expect(isEncapsulated('((brb))')).toBe(true)
    expect(isEncapsulated('[[afk]]')).toBe(true)
    expect(isEncapsulated('hello ((brb))')).toBe(false)
  })

  test('stripInlineOoc removes inner segments only', () => {
    expect(stripInlineOoc('Hello ((aside)) world [[note]] end')).toBe('Hello  world  end')
  })

  test('normalizePunctuation converts smart quotes and ellipsis', () => {
    expect(normalizePunctuation('\u2018hi\u2019 \u201cthere\u201d\u2026')).toBe('\'hi\' "there"...')
  })
})
