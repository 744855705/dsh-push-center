/** Small pure helpers shared by channel renderers. */
import type { RenderedMessage } from './types.js'

/**
 * Truncate at a line boundary near the limit so a push never ends mid-table-row.
 * @param text - the text to fit.
 * @param max - the character budget.
 * @returns the text unchanged, or a line-boundary cut with an ellipsis.
 */
export function truncateAtLine(text: string, max: number): string {
  if (text.length <= max) return text
  const newline = text.lastIndexOf('\n', max - 1)
  const at = newline >= Math.floor(max * 0.6) ? newline : max - 1
  return `${text.slice(0, at).trimEnd()}…`
}

/**
 * Title and body as one plain block.
 * @param title - optional heading.
 * @param body - message body.
 * @returns the joined text.
 */
export function plainBlock(title: string | undefined, body: string): string {
  return title === undefined || title.length === 0 ? body : `${title}\n\n${body}`
}

/**
 * Markdown block with an `##` heading.
 * @param title - optional heading.
 * @param body - message body.
 * @returns the joined markdown.
 */
export function markdownBlock(title: string | undefined, body: string): string {
  return title === undefined || title.length === 0 ? body : `## ${title}\n\n${body}`
}

/**
 * Render one outbound message as plain text within a character budget.
 * @param message - title/body pair.
 * @param max - character budget.
 * @returns the rendered message.
 */
export function renderPlain(message: { title?: string; body: string }, max: number): RenderedMessage {
  return { text: truncateAtLine(plainBlock(message.title, message.body), max) }
}

/**
 * Render one outbound message as markdown within a character budget.
 * @param message - title/body pair.
 * @param max - character budget.
 * @returns the rendered message.
 */
export function renderMarkdown(message: { title?: string; body: string }, max: number): RenderedMessage {
  return { text: truncateAtLine(markdownBlock(message.title, message.body), max) }
}
