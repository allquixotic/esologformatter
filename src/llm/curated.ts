import { fetchOpenRouterModels, type OpenRouterModelInfo } from './models'

// Keep the internal "curated" name and saved mode for existing browser settings.
export type CuratedTier = 'free' | 'cheap' | 'paid'

export interface CuratedEntry {
  slug: string
  displayName: string
  provider: string
  tier: CuratedTier
  aaii?: number
  priceInPerMillion: number
  priceOutPerMillion: number
  pricePerRequest: number
  contextLength: number
  supportedParameters: string[]
}

export interface CuratedCatalog {
  free: CuratedEntry[]
  cheap: CuratedEntry[]
  paid: CuratedEntry[]
  generatedAt: string
  source: 'live'
}

function convertModel(model: OpenRouterModelInfo): CuratedEntry {
  const priceInPerMillion = model.promptPrice * 1_000_000
  const priceOutPerMillion = model.completionPrice * 1_000_000
  const free = model.promptPrice === 0 && model.completionPrice === 0 && model.requestPrice === 0
  return {
    slug: model.id, displayName: model.name, provider: model.id.split('/')[0]!,
    tier: free ? 'free' : priceInPerMillion <= 1.5 && priceOutPerMillion <= 6 && model.requestPrice === 0 ? 'cheap' : 'paid',
    aaii: model.intelligenceIndex,
    priceInPerMillion, priceOutPerMillion, pricePerRequest: model.requestPrice,
    contextLength: model.contextLength, supportedParameters: model.supportedParameters,
  }
}

export async function loadCuratedCatalog(): Promise<CuratedCatalog> {
  const entries = (await fetchOpenRouterModels()).map(convertModel)
  // Missing scores stay unknown and sort after measured models. No index-version-dependent cutoffs.
  entries.sort((a, b) => (b.aaii ?? -1) - (a.aaii ?? -1) ||
    (a.priceInPerMillion + a.priceOutPerMillion) - (b.priceInPerMillion + b.priceOutPerMillion) ||
    a.slug.localeCompare(b.slug))
  return {
    free: entries.filter((e) => e.tier === 'free'),
    cheap: entries.filter((e) => e.tier === 'cheap'),
    paid: entries.filter((e) => e.tier === 'paid'),
    generatedAt: new Date().toISOString(), source: 'live',
  }
}

export function allEntries(catalog: CuratedCatalog): CuratedEntry[] {
  return [...catalog.free, ...catalog.cheap, ...catalog.paid]
}

export function findEntry(catalog: CuratedCatalog, slug: string): CuratedEntry | undefined {
  const lower = slug.trim().toLowerCase()
  return allEntries(catalog).find((e) => e.slug.toLowerCase() === lower)
}

export interface ModelResolution {
  modelSlug: string
  entry: CuratedEntry
  note: string
}

/** Automatic uses the highest-scoring affordable model; free-only is enforced for every mode. */
export function resolveModel(preference: string, freeOnly: boolean, catalog: CuratedCatalog | null): ModelResolution {
  if (!catalog) throw new Error('OpenRouter model list unavailable. Refresh models before using AI corrections.')
  const wantAuto = preference.trim().toLowerCase() === 'auto' || preference.trim() === ''
  const entry = wantAuto
    ? freeOnly ? catalog.free[0] : catalog.cheap[0] ?? catalog.free[0]
    : findEntry(catalog, preference)
  if (!entry) {
    if (!wantAuto) throw new Error(`Model ${preference.trim()} is no longer available for text corrections. Choose a model from the current list.`)
    throw new Error(freeOnly
      ? 'No free text models are available. Refresh models or turn off Free models only.'
      : 'No affordable text models are available. Refresh models or choose a model manually.')
  }
  if (freeOnly && entry.tier !== 'free') throw new Error('Free models only is enabled. Choose a free model or turn off that option.')
  const score = entry.aaii === undefined ? '' : ` · AA intelligence ${entry.aaii.toFixed(1)}`
  return { modelSlug: entry.slug, entry, note: `Selected ${entry.displayName} (${entry.slug}) · ${entry.tier}${score}` }
}
