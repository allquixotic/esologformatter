// Chromium built-in Prompt API provider (`LanguageModel` global, Gemini Nano).
// Experimental, Chrome-only; the correction system prompt is installed as the
// session's system initial prompt and each chunk is sent as a user turn.

import { CORRECTION_SYSTEM_PROMPT } from './correction'
import type { CorrectOpts, CorrectionProvider } from './types'

/** Conservative on-device context assumption (tokens) → 4,000-char chunks. */
const PROMPT_API_CONTEXT_TOKENS = 4_096

export type PromptApiAvailability =
  | 'unsupported'
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available'

export function isPromptApiSupported(): boolean {
  return typeof LanguageModel !== 'undefined'
}

export async function promptApiAvailability(): Promise<PromptApiAvailability> {
  if (!isPromptApiSupported()) {
    return 'unsupported'
  }
  try {
    return (await LanguageModel.availability()) as PromptApiAvailability
  } catch {
    return 'unavailable'
  }
}

export class PromptApiProvider implements CorrectionProvider {
  readonly label = 'Built-in browser AI (Gemini Nano)'
  private session: LanguageModel | null = null
  private readonly onDownloadProgress: ((fraction: number) => void) | undefined

  constructor(onDownloadProgress?: (fraction: number) => void) {
    this.onDownloadProgress = onDownloadProgress
  }

  contextLength(): Promise<number | undefined> {
    return Promise.resolve(PROMPT_API_CONTEXT_TOKENS)
  }

  private async ensureSession(): Promise<LanguageModel> {
    if (this.session) {
      return this.session
    }
    if (!isPromptApiSupported()) {
      throw new Error('The Prompt API (LanguageModel) is not supported in this browser.')
    }
    const progress = this.onDownloadProgress
    this.session = await LanguageModel.create({
      initialPrompts: [{ role: 'system', content: CORRECTION_SYSTEM_PROMPT }],
      monitor(m) {
        if (progress) {
          m.addEventListener('downloadprogress', (e) => {
            progress((e as ProgressEvent).loaded)
          })
        }
      },
    })
    return this.session
  }

  async correctChunk(chunk: string, opts: CorrectOpts): Promise<string> {
    const session = await this.ensureSession()
    return session.prompt(`Text to correct:\n${chunk}\n\nCorrected text:`, {
      signal: opts.signal,
    })
  }

  dispose(): void {
    this.session?.destroy()
    this.session = null
  }
}
