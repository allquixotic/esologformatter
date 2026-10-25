import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { allEntries, loadCuratedCatalog, resolveModel } from '../src/llm/curated'
import { fetchOpenRouterModels, OpenRouterProvider } from '../src/llm/openrouter'
import { createPinia, setActivePinia } from 'pinia'
import { generate } from '../src/app/runner'
import { useSessionStore } from '../src/stores/session'
import { useSettingsStore } from '../src/stores/settings'

const model = (id: string, score?: number) => ({
  id, name: id, context_length: 32_768,
  architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  pricing: { prompt: '0', completion: '0', request: '0' },
  benchmarks: { artificial_analysis: { intelligence_index: score } },
  supported_parameters: ['temperature'],
})
const paid = { ...model('vendor/paid', 40), pricing: { prompt: '0.000001', completion: '0.000002' } }
const mockFetch = () => spyOn(globalThis, 'fetch')
let fetchSpy: ReturnType<typeof mockFetch> | undefined
afterEach(() => fetchSpy?.mockRestore())

function serve(data: unknown[]): void {
  fetchSpy = mockFetch().mockResolvedValue(Response.json({ data, links: { next: null } }))
}

describe('live model discovery', () => {
  test('V10_UsesOpenRouterDirectlyAndFollowsPagination', async () => {
    fetchSpy = mockFetch()
      .mockResolvedValueOnce(Response.json({ data: [paid], links: { next: '/api/v1/models?offset=1' } }))
      .mockResolvedValueOnce(Response.json({ data: [model('vendor/free:free', 26)], links: { next: null } }))
    const catalog = await loadCuratedCatalog()
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
      'https://openrouter.ai/api/v1/models', 'https://openrouter.ai/api/v1/models?offset=1',
    ])
    expect(catalog.source).toBe('live')
    expect(catalog.free[0]?.slug).toBe('vendor/free:free')
    expect(catalog.cheap[0]?.priceInPerMillion).toBe(1)
    expect(catalog.cheap[0]?.contextLength).toBe(32_768)
  })

  test('V13_RanksCurrentScoresWithoutObsoleteThresholdsOrInventingScores', async () => {
    serve([model('vendor/unscored'), model('vendor/weaker', 9), model('vendor/better', 26.5), paid])
    const catalog = await loadCuratedCatalog()
    expect(catalog.free.map((entry) => entry.slug)).toEqual(['vendor/better', 'vendor/weaker', 'vendor/unscored'])
    expect(catalog.free[2]?.aaii).toBeUndefined()
    expect(resolveModel('auto', true, catalog).modelSlug).toBe('vendor/better')
    expect(resolveModel('auto', false, catalog).modelSlug).toBe('vendor/paid')
  })

  test('V10_ExcludesUnsuitableAndMalformedModels', async () => {
    serve([
      model('vendor/good'), null, { id: 12 },
      { ...model('vendor/no-price'), pricing: {} },
      { ...model('vendor/bad-price'), pricing: { prompt: '', completion: '-1' } },
      { ...model('vendor/audio'), architecture: { input_modalities: ['text'], output_modalities: ['text', 'audio'] } },
      { ...model('vendor/no-text'), architecture: { input_modalities: ['image'], output_modalities: ['text'] } },
      { ...model('vendor/short'), context_length: 1024 },
      { ...model('vendor/expired'), expiration_date: '2000-01-01' },
      model('vendor/model:batch'), model('vendor/content-safety'), model('openrouter/auto'),
    ])
    expect(allEntries(await loadCuratedCatalog()).map((entry) => entry.slug)).toEqual(['vendor/good'])
  })

  test('V11_FreeRequiresZeroPricesIncludingRequestAndPricingOverrides', async () => {
    serve([
      model('vendor/free'),
      { ...model('vendor/request'), pricing: { prompt: '0', completion: '0', request: '0.01' } },
      { ...model('vendor/overrides'), pricing: { prompt: '0', completion: '0', overrides: [{ prompt: '0.000002' }] } },
      { ...model('vendor/reasoning'), pricing: { prompt: '0', completion: '0', internal_reasoning: '0.000001' } },
      { ...model('vendor/unknown'), pricing: { prompt: '0', completion: '0', request: 'unknown' } },
    ])
    const catalog = await loadCuratedCatalog()
    expect(catalog.free.map((entry) => entry.slug)).toEqual(['vendor/free'])
    expect(() => resolveModel('vendor/request', true, catalog)).toThrow('Free models only')
  })

  test('V11_NeverFallsBackToPaidWhenFreeListIsEmpty', async () => {
    serve([paid])
    const catalog = await loadCuratedCatalog()
    expect(() => resolveModel('auto', true, null)).toThrow()
    expect(() => resolveModel('auto', true, catalog)).toThrow()
  })

  test('V12_RejectsRetiredExplicitModelsAndNormalizesValidIds', async () => {
    serve([model('vendor/current')])
    const catalog = await loadCuratedCatalog()
    expect(() => resolveModel('vendor/retired:free', true, catalog)).toThrow('no longer available')
    expect(resolveModel('  VENDOR/CURRENT  ', true, catalog).modelSlug).toBe('vendor/current')
  })

  test('V12_EmptyAndFailedResponsesNeverResurrectBundledModels', async () => {
    serve([])
    const catalog = await loadCuratedCatalog()
    expect(() => resolveModel('auto', false, null)).toThrow()
    expect(() => resolveModel('auto', false, catalog)).toThrow()
  })

  test.each([503, 429])('V12_HTTP%sIsAnActionableFailure', async (status) => {
    fetchSpy = mockFetch().mockResolvedValue(new Response('', { status }))
    await expect(loadCuratedCatalog()).rejects.toThrow(`HTTP ${status}`)
  })

  test('V10_RejectsMalformedEnvelope', async () => {
    fetchSpy = mockFetch().mockResolvedValue(Response.json({ error: 'bad response' }))
    await expect(fetchOpenRouterModels()).rejects.toThrow('model list')
  })

  test.each(['https://example.com/models', '/api/v1/models'])('V10_RejectsUnsafeOrLoopingPagination_%s', async (next) => {
    fetchSpy = mockFetch().mockResolvedValue(Response.json({ data: [paid], links: { next } }))
    await expect(fetchOpenRouterModels()).rejects.toThrow('pagination')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test('V10_DeduplicatesPages', async () => {
    fetchSpy = mockFetch()
      .mockResolvedValueOnce(Response.json({ data: [paid], links: { next: '?offset=1' } }))
      .mockResolvedValueOnce(Response.json({ data: [paid], links: { next: null } }))
    expect(await fetchOpenRouterModels()).toHaveLength(1)
  })
})

test('V11_CompletionEnforcesZeroPriceAndOmitsUnsupportedTemperature', async () => {
  fetchSpy = mockFetch().mockResolvedValue(Response.json({ choices: [{ message: { content: 'Corrected.' } }] }))
  const provider = new OpenRouterProvider('test-key', 'vendor/free', 32_768, {
    freeOnly: true, supportedParameters: [],
  })
  expect(await provider.correctChunk('Text.', { temperature: 0.3 })).toBe('Corrected.')
  const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
  expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0, request: 0 })
  expect(body.temperature).toBeUndefined()
  expect(body.model).toBe('vendor/free')
})

test.each(['failed-fetch', 'paid-selection', 'retired-selection'])('V12_DiscoveryFailurePreservesOutput_%s', async (failure) => {
  setActivePinia(createPinia())
  const settings = useSettingsStore()
  settings.$patch({ useAi: true, freeModelsOnly: true, modelMode: 'manual',
    modelId: failure === 'retired-selection' ? 'vendor/retired' : 'vendor/paid', openrouterApiKey: 'test-key' })
  const session = useSessionStore()
  session.setFiles([{ name: 'test.log', text: '2026-07-03T18:01:46.796-05:00 0,Test Character,Hello friend\n' }])
  serve([paid])
  if (failure === 'failed-fetch') fetchSpy!.mockRejectedValue(new Error('Network unavailable'))
  await generate()
  expect(session.result?.content).toContain('Hello friend')
  expect(session.log.some((event) => event.kind === 'error' && event.message.includes('Using original text'))).toBe(true)
  expect(session.running).toBe(false)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(String(fetchSpy!.mock.calls[0]?.[0])).toBe('https://openrouter.ai/api/v1/models')
})
