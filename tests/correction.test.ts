import { describe, expect, test } from 'bun:test'
import {
  buildCorrectionPrompt,
  calculateChunkSize,
  chunkText,
  cleanModelResponse,
  CORRECTION_SYSTEM_PROMPT,
  correctText,
} from '../src/llm/correction'
import { resolveModel, type CuratedCatalog } from '../src/llm/curated'
import type { CorrectOpts, CorrectionProvider } from '../src/llm/types'

describe('calculateChunkSize (rconv table)', () => {
  test('boundaries', () => {
    expect(calculateChunkSize(undefined)).toBe(30_000)
    expect(calculateChunkSize(0)).toBe(30_000)
    expect(calculateChunkSize(1)).toBe(4_000)
    expect(calculateChunkSize(32_767)).toBe(4_000)
    expect(calculateChunkSize(32_768)).toBe(8_000)
    expect(calculateChunkSize(131_071)).toBe(8_000)
    expect(calculateChunkSize(131_072)).toBe(30_000)
    expect(calculateChunkSize(1_048_575)).toBe(30_000)
    expect(calculateChunkSize(1_048_576)).toBe(60_000)
  })
})

describe('chunkText', () => {
  test('small input stays whole', () => {
    expect(chunkText('a\nb', 100)).toEqual(['a\nb'])
  })

  test('splits on line boundaries within limit', () => {
    const line = 'x'.repeat(40)
    const text = [line, line, line].join('\n')
    const chunks = chunkText(text, 90)
    expect(chunks).toEqual([`${line}\n${line}`, line])
    expect(chunks.every((c) => c.length <= 90)).toBe(true)
  })
})

describe('cleanModelResponse', () => {
  test('strips markdown fences and whitespace', () => {
    expect(cleanModelResponse('```\nHello.\n```')).toBe('Hello.')
    expect(cleanModelResponse('  Hello.  ')).toBe('Hello.')
    expect(cleanModelResponse('``````Hi``````')).toBe('Hi')
  })
})

describe('prompt shape', () => {
  test('matches rconv message layout', () => {
    const prompt = buildCorrectionPrompt('Some text')
    expect(prompt.startsWith(CORRECTION_SYSTEM_PROMPT)).toBe(true)
    expect(prompt).toEndWith('\n\nText to correct:\nSome text\n\nCorrected text:')
    expect(CORRECTION_SYSTEM_PROMPT).toContain('CRITICAL INSTRUCTION BOUNDARY')
  })
})

class FakeProvider implements CorrectionProvider {
  readonly label = 'fake'
  calls: string[] = []
  constructor(private readonly ctx: number | undefined) {}
  contextLength(): Promise<number | undefined> {
    return Promise.resolve(this.ctx)
  }
  correctChunk(chunk: string, _opts: CorrectOpts): Promise<string> {
    this.calls.push(chunk)
    return Promise.resolve('```\n' + chunk.toUpperCase() + '\n```')
  }
}

describe('correctText', () => {
  test('runs chunks sequentially and rejoins with newlines', async () => {
    const provider = new FakeProvider(1000) // -> 4,000 char chunks
    const line = 'y'.repeat(3000)
    const text = `${line}\n${line}`
    const result = await correctText(provider, text)
    expect(provider.calls).toHaveLength(2)
    expect(result).toBe(`${line.toUpperCase()}\n${line.toUpperCase()}`)
  })
})

describe('resolveModel', () => {
  const catalog: CuratedCatalog = {
    free: [
      { slug: 'f/one:free', displayName: 'Free One', provider: 'f', tier: 'free', aaii: 10 },
    ],
    cheap: [
      { slug: 'c/two', displayName: 'Cheap Two', provider: 'c', tier: 'cheap', aaii: 20 },
    ],
    generatedAt: 'now',
    source: 'bundled',
  }

  test('auto picks first cheap entry', () => {
    expect(resolveModel('auto', false, catalog).modelSlug).toBe('c/two')
  })

  test('auto with free-only picks first free entry', () => {
    expect(resolveModel('auto', true, catalog).modelSlug).toBe('f/one:free')
  })

  test('auto without catalog falls back to default model', () => {
    expect(resolveModel('auto', false, null).modelSlug).toBe('google/gemini-2.5-flash-lite')
  })

  test('explicit slug is used even when not curated', () => {
    const r = resolveModel('someorg/custom-model', false, catalog)
    expect(r.modelSlug).toBe('someorg/custom-model')
    expect(r.entry).toBeNull()
  })
})
