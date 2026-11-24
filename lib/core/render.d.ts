/** Small pure helpers shared by channel renderers. */
import type { RenderedMessage } from './types.js';
/**
 * Truncate at a line boundary near the limit so a push never ends mid-table-row.
 * @param text - the text to fit.
 * @param max - the character budget.
 * @returns the text unchanged, or a line-boundary cut with an ellipsis.
 */
export declare function truncateAtLine(text: string, max: number): string;
/**
 * Title and body as one plain block.
 * @param title - optional heading.
 * @param body - message body.
 * @returns the joined text.
 */
export declare function plainBlock(title: string | undefined, body: string): string;
/**
 * Markdown block with an `##` heading.
 * @param title - optional heading.
 * @param body - message body.
 * @returns the joined markdown.
 */
export declare function markdownBlock(title: string | undefined, body: string): string;
/**
 * Render one outbound message as plain text within a character budget.
 * @param message - title/body pair.
 * @param max - character budget.
 * @returns the rendered message.
 */
export declare function renderPlain(message: {
    title?: string;
    body: string;
}, max: number): RenderedMessage;
/**
 * Render one outbound message as markdown within a character budget.
 * @param message - title/body pair.
 * @param max - character budget.
 * @returns the rendered message.
 */
export declare function renderMarkdown(message: {
    title?: string;
    body: string;
}, max: number): RenderedMessage;
