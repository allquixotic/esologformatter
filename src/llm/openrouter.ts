// OpenRouter access: chat completions via the official OpenAI SDK
// (OpenRouter is OpenAI-compatible), live model listing, and the PKCE OAuth
// flow ported from rconv-core/src/openrouter.rs adapted to a static site.

import OpenAI from 'openai'
import { buildCorrectionPrompt } from './correction'
import type { CorrectOpts, CorrectionProvider } from './types'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
/** rconv DEFAULT_OPENROUTER_MODEL. */
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite'

export interface OpenRouterModelInfo {
  id: string
  name: string
  contextLength?: number
  /** Per-token prices as decimal strings ("0" = free). */
  promptPrice: string
  completionPrice: string
}

interface RawModelsResponse {
  data?: {
    id: string
    name?: string
    context_length?: number | null
    pricing?: { prompt?: string; completion?: string }
  }[]
}

/** Fetch the live OpenRouter model list (no auth required). */
export async function fetchOpenRouterModels(signal?: AbortSignal): Promise<OpenRouterModelInfo[]> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/models`, { signal })
  if (!res.ok) {
    throw new Error(`Failed to fetch models: HTTP ${res.status}`)
  }
  const body = (await res.json()) as RawModelsResponse
  return (body.data ?? []).map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    contextLength: m.context_length ?? undefined,
    promptPrice: m.pricing?.prompt ?? '',
    completionPrice: m.pricing?.completion ?? '',
  }))
}

/** Chat-completions correction provider backed by OpenRouter. */
export class OpenRouterProvider implements CorrectionProvider {
  readonly label: string
  private readonly client: OpenAI
  private readonly model: string
  private readonly knownContextLength: number | undefined

  constructor(apiKey: string, model: string, knownContextLength?: number) {
    this.model = model
    this.knownContextLength = knownContextLength
    this.label = `OpenRouter (${model})`
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      dangerouslyAllowBrowser: true,
    })
  }

  async contextLength(): Promise<number | undefined> {
    if (this.knownContextLength !== undefined) {
      return this.knownContextLength
    }
    try {
      const models = await fetchOpenRouterModels()
      return models.find((m) => m.id === this.model)?.contextLength
    } catch {
      return undefined
    }
  }

  async correctChunk(chunk: string, opts: CorrectOpts): Promise<string> {
    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [{ role: 'user', content: buildCorrectionPrompt(chunk) }],
        temperature: opts.temperature,
      },
      { signal: opts.signal },
    )
    const content = completion.choices[0]?.message?.content
    if (content === null || content === undefined || content === '') {
      throw new Error('No response content from OpenRouter')
    }
    return content
  }
}

// ---------------------------------------------------------------------------
// PKCE OAuth (S256) for a static site: verifier lives in sessionStorage while
// the user round-trips through openrouter.ai; the code is exchanged for an
// API key with a CORS POST.
// ---------------------------------------------------------------------------

const VERIFIER_STORAGE_KEY = 'esologformatter.openrouter.pkceVerifier'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = base64UrlEncode(bytes)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) }
}

export function buildOAuthUrl(challenge: string, callbackUrl: string): string {
  const params = new URLSearchParams({
    callback_url: callbackUrl,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `https://openrouter.ai/auth?${params.toString()}`
}

export async function exchangeCodeForApiKey(code: string, verifier: string): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/auth/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
  })
  if (!res.ok) {
    throw new Error(`Failed to exchange code: HTTP ${res.status}`)
  }
  const body = (await res.json()) as { key?: string }
  if (!body.key) {
    throw new Error('OpenRouter did not return an API key')
  }
  return body.key
}

/** Kick off the OAuth flow by redirecting the page to OpenRouter. */
export async function startOAuthLogin(): Promise<void> {
  const { verifier, challenge } = await generatePkcePair()
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier)
  const callbackUrl = window.location.origin + window.location.pathname
  window.location.assign(buildOAuthUrl(challenge, callbackUrl))
}

/**
 * If the current URL carries an OAuth `code`, exchange it for an API key.
 * Returns null when no code is present. Cleans the code out of the URL.
 */
export async function completeOAuthLogin(): Promise<string | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code) {
    return null
  }
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY)
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY)
  url.searchParams.delete('code')
  window.history.replaceState(null, '', url.toString())
  if (!verifier) {
    throw new Error('OAuth verifier missing — please try connecting again.')
  }
  return exchangeCodeForApiKey(code, verifier)
}
