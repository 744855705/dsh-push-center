/** WeChat text rendering quirks.
 *
 * ClawBot renders text as markdown and collapses hard breaks, so only a blank
 * line survives. Single newlines become paragraph breaks - except between
 * markdown table rows, where a blank line dissolves the table.
 */
import type { RenderedMessage } from '../../core/types.js';
/** Longest text one WeChat message accepts. */
export declare const MAX_TEXT = 2000;
/**
 * Render one message as WeChat text.
 * @param message - title and body.
 * @returns the rendered text within the size limit.
 */
export declare function renderWechatText(message: {
    title?: string;
    body: string;
}): RenderedMessage;
