// Faithful TypeScript port of the text-cleanup helpers in
// rconv-core/src/runtime.rs.

const INLINE_OOC_RE = /(\(\(|\[\[).*?(\)\)|\]\])/g

export function isQuote(ch: string): boolean {
  return ch === '"' || ch === "'" || ch === '\u2018' || ch === '\u2019' || ch === '\u201c' || ch === '\u201d'
}

export function isPunctuationChar(ch: string): boolean {
  return ch === '.' || ch === '!' || ch === '?'
}

/** True when the message is entirely wrapped in `((...))` or `[[...]]`. */
export function isEncapsulated(msg: string): boolean {
  return (
    (msg.startsWith('((') && msg.endsWith('))')) ||
    (msg.startsWith('[[') && msg.endsWith(']]'))
  )
}

/** Remove inline out-of-character segments: `((text))` and `[[text]]`. */
export function stripInlineOoc(msg: string): string {
  return msg.replace(INLINE_OOC_RE, '')
}

/** Normalize smart quotes and ellipsis characters, and trim. */
export function normalizePunctuation(msg: string): string {
  return msg
    .replaceAll('\u2018', "'")
    .replaceAll('\u2019', "'")
    .trim()
    .replaceAll('\u201c', '"')
    .replaceAll('\u201d', '"')
    .replaceAll('\u2026', '...')
}

export function endsWithPunctuation(s: string): boolean {
  let tmp = s.trim()
  while (tmp.endsWith('>') || tmp.endsWith('+')) {
    tmp = tmp.slice(0, -1).trimEnd()
  }
  for (let i = tmp.length - 1; i >= 0; i--) {
    const ch = tmp[i]!
    if (isQuote(ch)) {
      continue
    }
    // Found the last non-quote char.
    return isPunctuationChar(ch) || tmp.endsWith('...')
  }
  return false
}

export function isQuoted(s: string): boolean {
  let tmp = s.trim()
  while (tmp.endsWith('>') || tmp.endsWith('+')) {
    tmp = tmp.slice(0, -1).trimEnd()
  }
  const first = tmp.charAt(0)
  const last = tmp.charAt(tmp.length - 1)
  if (first === '') {
    return false
  }
  return isQuote(first) && (isQuote(last) || isPunctuationChar(last))
}

/** Ensure the string ends with sentence punctuation (inserted before a final quote when present). */
export function ensureEndPunc(s: string): string {
  if (endsWithPunctuation(s)) {
    return s
  }
  const last = s.charAt(s.length - 1)
  if (last !== '' && isQuote(last)) {
    return s.slice(0, -1) + '.' + last
  }
  return s + '.'
}
