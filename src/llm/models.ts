// Public, CORS-enabled OpenRouter catalog. No account credentials or snapshot job required.
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const MODELS_URL = `${OPENROUTER_BASE_URL}/models`
const FETCH_TIMEOUT_MS = 10_000

export interface OpenRouterModelInfo {
  id: string
  name: string
  contextLength: number
  promptPrice: number
  completionPrice: number
  requestPrice: number
  intelligenceIndex?: number
  supportedParameters: string[]
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function price(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return
  const result = Number(value)
  return Number.isFinite(result) && result >= 0 ? result : undefined
}

/** Use the highest published rate, including time/context pricing overrides. */
function maxPrice(pricing: Record<string, unknown>, key: string, optional = false): number | undefined {
  const base = pricing[key] === undefined && optional ? 0 : price(pricing[key])
  if (base === undefined) return
  let result = base
  if (pricing.overrides !== undefined && !Array.isArray(pricing.overrides)) return
  for (const raw of (pricing.overrides as unknown[] | undefined) ?? []) {
    const override = record(raw)
    if (override[key] === undefined) continue
    const value = price(override[key])
    if (value === undefined) return
    result = Math.max(result, value)
  }
  return result
}

function parseModel(value: unknown): OpenRouterModelInfo | null {
  const raw = record(value)
  if (typeof raw.id !== 'string' || !raw.id.includes('/')) return null
  // Exclude batch, general-purpose routers, and classification models; family aliases remain usable.
  if (raw.id.endsWith(':batch') || raw.id.startsWith('openrouter/') ||
      /(?:^|[-/])(content-safety|guard|moderation|embed|embedding|rerank)(?:[-/:]|$)/i.test(raw.id)) return null
  const architecture = record(raw.architecture)
  if (!Array.isArray(architecture.input_modalities) || !architecture.input_modalities.includes('text') ||
      !Array.isArray(architecture.output_modalities) || architecture.output_modalities.length !== 1 ||
      architecture.output_modalities[0] !== 'text') return null
  if (typeof raw.context_length !== 'number' || !Number.isFinite(raw.context_length) || raw.context_length < 8192) return null
  if (typeof raw.expiration_date === 'string') {
    const expires = Date.parse(raw.expiration_date)
    if (!Number.isFinite(expires) || expires <= Date.now()) return null
  }
  const pricing = record(raw.pricing)
  const promptPrice = maxPrice(pricing, 'prompt')
  const completionPrice = maxPrice(pricing, 'completion')
  const requestPrice = maxPrice(pricing, 'request', true)
  const reasoningPrice = maxPrice(pricing, 'internal_reasoning', true)
  if (promptPrice === undefined || completionPrice === undefined || requestPrice === undefined || reasoningPrice === undefined) return null
  const score = record(record(raw.benchmarks).artificial_analysis).intelligence_index
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : raw.id,
    contextLength: raw.context_length,
    promptPrice,
    completionPrice: Math.max(completionPrice, reasoningPrice),
    requestPrice,
    intelligenceIndex: typeof score === 'number' && Number.isFinite(score) && score >= 0 ? score : undefined,
    supportedParameters: Array.isArray(raw.supported_parameters)
      ? raw.supported_parameters.filter((p): p is string => typeof p === 'string') : [],
  }
}

/** Read every page; reject invalid responses instead of substituting retired models. */
export async function fetchOpenRouterModels(signal?: AbortSignal): Promise<OpenRouterModelInfo[]> {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const fetchSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  const models = new Map<string, OpenRouterModelInfo>()
  const visited = new Set<string>()
  let url: string | null = MODELS_URL
  while (url) {
    if (visited.has(url) || visited.size >= 50) throw new Error('Invalid OpenRouter model pagination')
    visited.add(url)
    const res = await fetch(url, { signal: fetchSignal })
    if (!res.ok) throw new Error(`Could not load OpenRouter model list: HTTP ${res.status}. Try Refresh models.`)
    const body = record(await res.json())
    if (!Array.isArray(body.data)) throw new Error('Invalid OpenRouter model list response. Try Refresh models.')
    for (const raw of body.data) {
      const model = parseModel(raw)
      if (model) models.set(model.id, model)
    }
    const next = record(body.links).next
    if (next === undefined || next === null) {
      url = null
    } else {
      if (typeof next !== 'string' || !next) throw new Error('Invalid OpenRouter model pagination')
      const nextUrl: URL = new URL(next, url)
      if (nextUrl.origin !== 'https://openrouter.ai' || nextUrl.pathname !== '/api/v1/models' ||
          nextUrl.username || nextUrl.password || nextUrl.hash || visited.has(nextUrl.href)) {
        throw new Error('Invalid OpenRouter model pagination')
      }
      url = nextUrl.href
    }
  }
  return [...models.values()]
}
