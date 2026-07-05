import type { ChatLine } from '../types'
import { formatTimestamp, type TimeFormat } from './time'

export interface TableOptions {
  timeFormat: TimeFormat
  labels: Readonly<Record<number, string>>
  title?: string
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Legacy "HTML Table" output as a standalone document (every cell escaped).
 */
export function renderTableDocument(lines: readonly ChatLine[], opts: TableOptions): string {
  const showTime = opts.timeFormat !== 'none'
  const title = escapeHtml(opts.title ?? 'ESO Chat Log')

  const rows: string[] = []
  for (const line of lines) {
    const label = opts.labels[line.channel] ?? `Channel ${line.channel}`
    const cells: string[] = []
    if (showTime) {
      cells.push(`<td>${escapeHtml(formatTimestamp(line.timestamp, opts.timeFormat))}</td>`)
    }
    cells.push(`<td>${escapeHtml(label)}</td>`)
    cells.push(`<td>${escapeHtml(line.from)}</td>`)
    cells.push(`<td class="msg">${escapeHtml(line.message)}</td>`)
    rows.push(`      <tr>${cells.join('')}</tr>`)
  }

  const headCells = [
    ...(showTime ? ['<th>Time</th>'] : []),
    '<th>Channel</th>',
    '<th>From</th>',
    '<th>Message</th>',
  ].join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 0.3rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #eee; }
  td.msg { word-wrap: break-word; overflow-wrap: anywhere; }
  @media (prefers-color-scheme: dark) {
    body { background: #121212; color: #eee; }
    th { background: #2a2a2a; }
    th, td { border-color: #555; }
  }
</style>
</head>
<body>
<h1>${title}</h1>
<table>
  <thead>
    <tr>${headCells}</tr>
  </thead>
  <tbody>
${rows.join('\n')}
  </tbody>
</table>
</body>
</html>
`
}
