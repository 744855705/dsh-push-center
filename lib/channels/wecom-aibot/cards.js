/** WeCom allows six buttons on a button_interaction card. */
const MAX_BUTTONS = 6;
/** WeCom recommends short button labels. */
const MAX_LABEL = 10;
const MAX_TITLE = 26;
const MAX_SUBTITLE = 112;
const APPROVE_KEY = 'approve';
const REJECT_KEY = 'reject';
const CHOICE_PREFIX = 'choice:';
const COMMAND_PREFIX = 'command:';
/**
 * Stable key for one action, encoded so a tap maps back without extra state.
 * @param action - the action.
 * @param index - its position in the message.
 * @returns the key sent with the button.
 */
export function cardKey(action, index) {
    if (action.intent === 'accept')
        return APPROVE_KEY;
    if (action.intent === 'reject')
        return REJECT_KEY;
    if (action.intent === 'command')
        return COMMAND_PREFIX + (action.value ?? action.id);
    return CHOICE_PREFIX + (action.value ?? String(index + 1));
}
/**
 * Translate a tapped button into the shared reply vocabulary.
 * @param key - the event_key WeCom reported.
 * @returns 'Y', 'N', an option number, a command, or null when unknown.
 */
export function mapCardKey(key) {
    if (key === undefined)
        return null;
    if (key === APPROVE_KEY)
        return 'Y';
    if (key === REJECT_KEY)
        return 'N';
    if (key.startsWith(CHOICE_PREFIX))
        return key.slice(CHOICE_PREFIX.length) || null;
    if (key.startsWith(COMMAND_PREFIX))
        return key.slice(COMMAND_PREFIX.length) || null;
    return null;
}
/** Cut at the limit, marking the cut. */
function clip(text, max) {
    const value = text.trim();
    return value.length <= max ? value : value.slice(0, max - 1) + '…';
}
/**
 * Build a button_interaction card for one prompt.
 *
 * Text replies stay valid: the body keeps the reply instructions, so a reader
 * can either tap a button or type Y/N/option number.
 * @param view - title, body and actions.
 * @param taskId - unique task id for this card.
 * @returns the card to send.
 */
export function buildPromptCard(view, taskId) {
    const buttons = view.actions.slice(0, MAX_BUTTONS).map((action, index) => ({
        text: clip(action.label, MAX_LABEL),
        style: action.intent === 'reject' ? 2 : 1,
        key: cardKey(action, index),
    }));
    return {
        card_type: 'button_interaction',
        task_id: taskId,
        main_title: { title: clip(view.title ?? 'DSH', MAX_TITLE) },
        sub_title_text: clip(view.body, MAX_SUBTITLE),
        button_list: buttons,
    };
}
/**
 * Read a tap.
 *
 * WeCom nests the payload under event.template_card_event
 * ({ eventtype, template_card_event: { event_key, task_id } }) while the SDK
 * type and its examples flatten the fields onto event. Reading only the flat
 * shape drops every real tap.
 * @param body - the frame body.
 * @returns the card fields, or undefined when the body carries none.
 */
export function cardEventOf(body) {
    if (body === null || typeof body !== 'object')
        return undefined;
    const event = body.event;
    if (event === null || typeof event !== 'object')
        return undefined;
    const record = event;
    const nested = record.template_card_event;
    const source = nested !== null && typeof nested === 'object' ? nested : record;
    const eventKey = typeof source.event_key === 'string' ? source.event_key : undefined;
    const taskId = typeof source.task_id === 'string' ? source.task_id : undefined;
    return {
        ...(eventKey === undefined ? {} : { eventKey }),
        ...(taskId === undefined ? {} : { taskId }),
    };
}
//# sourceMappingURL=cards.js.map