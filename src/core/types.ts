/** A single parsed ESO chat log line. */
export interface ChatLine {
  /** Original ISO timestamp exactly as written in the log, e.g. `2025-09-09T21:04:27.785-05:00`. */
  timestamp: string
  /** Epoch milliseconds derived from {@link timestamp} (used for range filtering and sorting). */
  epochMs: number
  /** Numeric chat channel (0–35). */
  channel: number
  /** Sender (character/account) exactly as written. */
  from: string
  /** Raw message text. */
  message: string
  /** Source file name (for multi-file sessions). */
  file: string
  /** Monotonic ordering index across all parsed input, preserving original order. */
  index: number
}

export interface InputFile {
  name: string
  text: string
}
