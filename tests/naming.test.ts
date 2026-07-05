import { describe, expect, test } from 'bun:test'
import { defaultOutputName, sanitizeForFilename, uneditedName } from '../src/core/naming'

describe('naming', () => {
  test('preset mode uses prefix-MMDDYY', () => {
    expect(
      defaultOutputName({ dateMode: 'preset', format: 'narrative', filePrefix: 'conv', fileDate: '101125' }),
    ).toBe('conv-101125.txt')
  })

  test('custom range uses sanitized event bounds', () => {
    expect(
      defaultOutputName({
        dateMode: 'custom',
        format: 'plain',
        startIso: '2025-10-11T22:00',
        endIso: '2025-10-12T00:25',
      }),
    ).toBe('event-2025-10-11_22-00-2025-10-12_00-25.txt')
  })

  test('table format uses .html', () => {
    expect(defaultOutputName({ dateMode: 'all', format: 'table' })).toBe('processed-output.html')
  })

  test('sanitizeForFilename replaces colons and T', () => {
    expect(sanitizeForFilename('2025-10-11T22:00')).toBe('2025-10-11_22-00')
  })

  test('unedited sibling name', () => {
    expect(uneditedName('conv-101125.txt')).toBe('conv-101125_unedited.txt')
    expect(uneditedName('output')).toBe('output_unedited.txt')
  })
})
