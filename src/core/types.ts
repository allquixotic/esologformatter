/** A single parsed ESO chat log line. */
export interface ChatLine {
  /** Original ISO timestamp exactly as written in the log, e.g. `2025-09-09T21:04:27.785-05:00`. */
  timestamp: string
  /** Epoch milliseconds derived from {@link timestamp} (used for sorting). */
  epochMs: number
  /**
   * The timestamp's wall-clock components re-interpreted as UTC, e.g.
   * `2026-07-03T18:01:46.796-05:00` -> `Date.UTC(2026, 6, 3, 18, 1, 46, 796)`.
   * ESO writes the player's wall clock but with a fixed, DST-ignorant UTC
   * offset, so date-range filtering must compare wall-clock values (rconv
   * parity: naive `YYYY-MM-DDTHH:MM` string comparison), never real epochs.
   */
  wallMs: number
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
