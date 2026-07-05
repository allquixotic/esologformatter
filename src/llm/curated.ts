// Curated model catalog ported from rconv-core/src/curator.rs: remote
// snapshot (schema v2) with a bundled fallback copy, plus rconv's
// auto/explicit resolution rules.

import fallbackSnapshotJson from './model-snapshot.fallback.json'
import { DEFAULT_OPENROUTER_MODEL } from './openrouter'

const SNAPSHOT_URL =
  'https://raw.githubusercontent.com/allquixotic/convocations/refs/heads/main/static/model_snapshot.json'
const SNAPSHOT_SCHEMA_VERSION = 2
const REMOTE_FETCH_TIMEOUT_MS = 5_000

export type CuratedTier = 'free' | 'cheap'

export interface CuratedEntry {
  slug: string
  displayName: string
  provider: string
  tier: CuratedTier
  aaii: number
  priceInPerMillion?: number
  priceOutPerMillion?: number
  contextLength?: number
}

export interface CuratedCatalog {
  free: CuratedEntry[]
  cheap: CuratedEntry[]
  generatedAt: string
  source: 'remote' | 'bundled'
}

interface RawEntry {
  slug: string
  display_name: string
  provider: string
  aaii: number
  price_in_per_million?: number | null
  price_out_per_million?: number | null
  context_length?: number | null
}

interface RawSnapshot {
  schema_version: number
  generated_at: string
  free: RawEntry[]
  cheap: RawEntry[]
}

function convertEntry(raw: RawEntry, tier: CuratedTier): CuratedEntry {
  return {
    slug: raw.slug,
    displayName: raw.display_name,
    provider: raw.provider,
    tier,
    aaii: raw.aaii,
    priceInPerMillion: raw.price_in_per_million ?? undefined,
    priceOutPerMillion: raw.price_out_per_million ?? undefined,
    contextLength: raw.context_length ?? undefined,
  }
}

function convertSnapshot(raw: RawSnapshot, source: CuratedCatalog['source']): CuratedCatalog {
  if (raw.schema_version !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported snapshot schema version ${raw.schema_version}; expected ${SNAPSHOT_SCHEMA_VERSION}`,
    )
  }
  return {
    free: raw.free.map((e) => convertEntry(e, 'free')),
    cheap: raw.cheap.map((e) => convertEntry(e, 'cheap')),
    generatedAt: raw.generated_at,
    source,
  }
}

/** Fetch the remote curated snapshot (5s timeout), falling back to the bundled copy. */
export async function loadCuratedCatalog(): Promise<CuratedCatalog> {
  try {
    const res = await fetch(SNAPSHOT_URL, { signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS) })
    if (res.ok) {
      return convertSnapshot((await res.json()) as RawSnapshot, 'remote')
    }
  } catch {
    // Fall through to the bundled snapshot.
  }
  return convertSnapshot(fallbackSnapshotJson as unknown as RawSnapshot, 'bundled')
}

export function allEntries(catalog: CuratedCatalog): CuratedEntry[] {
  return [...catalog.free, ...catalog.cheap]
}

export function findEntry(catalog: CuratedCatalog, slug: string): CuratedEntry | undefined {
  const lower = slug.toLowerCase()
  return allEntries(catalog).find((e) => e.slug.toLowerCase() === lower)
}

export interface ModelResolution {
  modelSlug: string
  entry: CuratedEntry | null
  note: string
}

/**
 * rconv `resolve_preference` / `select_auto`: `auto` picks the first cheap
 * entry (or first free when filtering to free models); an explicit slug is
 * used directly whether or not it appears in the catalog.
 */
export function resolveModel(
  preference: string,
  freeOnly: boolean,
  catalog: CuratedCatalog | null,
): ModelResolution {
  const wantAuto = preference.trim().toLowerCase() === 'auto' || preference.trim() === ''
  if (wantAuto) {
    if (!catalog) {
      return {
        modelSlug: DEFAULT_OPENROUTER_MODEL,
        entry: null,
        note: `Curated snapshot unavailable; falling back to ${DEFAULT_OPENROUTER_MODEL}`,
      }
    }
    const pick = freeOnly
      ? (catalog.free[0] ?? catalog.cheap[0])
      : (catalog.cheap[0] ?? catalog.free[0])
    if (!pick) {
      return {
        modelSlug: DEFAULT_OPENROUTER_MODEL,
        entry: null,
        note: `Curated catalog empty for requested tier; using fallback ${DEFAULT_OPENROUTER_MODEL}`,
      }
    }
    return {
      modelSlug: pick.slug,
      entry: pick,
      note: `Curated model selected: ${pick.slug} (${pick.displayName}) · tier=${pick.tier} · AAII=${pick.aaii.toFixed(1)}`,
    }
  }

  const entry = catalog ? (findEntry(catalog, preference) ?? null) : null
  return {
    modelSlug: preference.trim(),
    entry,
    note: entry
      ? `Using explicit curated model: ${entry.slug} (${entry.displayName})`
      : `Using explicit model: ${preference.trim()}`,
  }
}
