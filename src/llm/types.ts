export interface CorrectOpts {
  temperature: number
  signal?: AbortSignal
}

/** A backend capable of correcting one chunk of text at a time. */
export interface CorrectionProvider {
  readonly label: string
  /** Model context length in tokens, when known (drives chunk sizing). */
  contextLength(): Promise<number | undefined>
  correctChunk(chunk: string, opts: CorrectOpts): Promise<string>
  dispose?(): void | Promise<void>
}

export type ProgressFn = (message: string) => void
