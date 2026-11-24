/** WeChat text rendering quirks.
 *
 * ClawBot renders text as markdown and collapses hard breaks, so only a blank
 * line survives. Single newlines become paragraph breaks - except between
 * markdown table rows, where a blank line dissolves the table.
 */
import type { RenderedMessage } from '../../core/types.js'
import { truncateAtLine } from '../../core/render.js'

/** Longest text one WeChat message accepts. */
export const MAX_TEXT = 2000

/** Whether a line is a markdown table row or separator. */
function isTableRow(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.startsWith('|')) return true
  return /^[\s:|-]*-+[\s:|-]*$/.test(trimmed) && trimmed.includes('-')
}

/** Drop blank lines whose neighbours above and below are both table rows. */
function tightenTables(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string
    if (line.trim() !== '') { out.push(line); continue }
    let above = index - 1
    while (above >= 0 && (lines[above] as string).trim() === '') above -= 1
    let below = index + 1
    while (below < lines.length && (lines[below] as string).trim() === '') below += 1
    const both = above >= 0 && below < lines.length &&
      isTableRow(lines[above] as string) && isTableRow(lines[below] as string)
    if (!both) out.push(line)
  }
  return out.join('\n')
}

/** Promote soft breaks to paragraph breaks, leaving table rows packed. */
function hardBreaks(text: string): string {
  const lines = text.split('\n')
  let out = ''
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index] as string
    const next = lines[index + 1] as string
    out += line
    out += line !== '' && next !== '' && !(isTableRow(line) && isTableRow(next)) ? '\n\n' : '\n'
  }
  return out + (lines[lines.length - 1] ?? '')
}

/**
 * Render one message as WeChat text.
 * @param message - title and body.
 * @returns the rendered text within the size limit.
 */
export function renderWechatText(message: { title?: string; body: string }): RenderedMessage {
  const raw = message.title === undefined || message.title.length === 0
    ? message.body
    : message.title + '\n\n' + message.body
  return { text: truncateAtLine(hardBreaks(tightenTables(raw)), MAX_TEXT) }
}
