import { truncateAtLine } from '../../core/render.js';
/** Longest text one WeChat message accepts. */
export const MAX_TEXT = 2000;
/** Whether a line is a markdown table row or separator. */
function isTableRow(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|'))
        return true;
    return /^[\s:|-]*-+[\s:|-]*$/.test(trimmed) && trimmed.includes('-');
}
/** Drop blank lines whose neighbours above and below are both table rows. */
function tightenTables(text) {
    const lines = text.split('\n');
    const out = [];
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() !== '') {
            out.push(line);
            continue;
        }
        let above = index - 1;
        while (above >= 0 && lines[above].trim() === '')
            above -= 1;
        let below = index + 1;
        while (below < lines.length && lines[below].trim() === '')
            below += 1;
        const both = above >= 0 && below < lines.length &&
            isTableRow(lines[above]) && isTableRow(lines[below]);
        if (!both)
            out.push(line);
    }
    return out.join('\n');
}
/** Promote soft breaks to paragraph breaks, leaving table rows packed. */
function hardBreaks(text) {
    const lines = text.split('\n');
    let out = '';
    for (let index = 0; index < lines.length - 1; index += 1) {
        const line = lines[index];
        const next = lines[index + 1];
        out += line;
        out += line !== '' && next !== '' && !(isTableRow(line) && isTableRow(next)) ? '\n\n' : '\n';
    }
    return out + (lines[lines.length - 1] ?? '');
}
/**
 * Render one message as WeChat text.
 * @param message - title and body.
 * @returns the rendered text within the size limit.
 */
export function renderWechatText(message) {
    const raw = message.title === undefined || message.title.length === 0
        ? message.body
        : message.title + '\n\n' + message.body;
    return { text: truncateAtLine(hardBreaks(tightenTables(raw)), MAX_TEXT) };
}
//# sourceMappingURL=render.js.map