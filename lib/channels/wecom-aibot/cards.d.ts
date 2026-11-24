/** WeCom button cards: approvals and questions as tappable actions. */
import type { TemplateCard } from '@wecom/aibot-node-sdk';
import type { Action } from '../../core/types.js';
/** What a card is built from: the domain message's title, body and actions. */
export interface CardView {
    readonly title?: string;
    readonly body: string;
    readonly actions: readonly Action[];
}
/**
 * Stable key for one action, encoded so a tap maps back without extra state.
 * @param action - the action.
 * @param index - its position in the message.
 * @returns the key sent with the button.
 */
export declare function cardKey(action: Action, index: number): string;
/**
 * Translate a tapped button into the shared reply vocabulary.
 * @param key - the event_key WeCom reported.
 * @returns 'Y', 'N', an option number, a command, or null when unknown.
 */
export declare function mapCardKey(key: string | undefined): string | null;
/**
 * Build a button_interaction card for one prompt.
 *
 * Text replies stay valid: the body keeps the reply instructions, so a reader
 * can either tap a button or type Y/N/option number.
 * @param view - title, body and actions.
 * @param taskId - unique task id for this card.
 * @returns the card to send.
 */
export declare function buildPromptCard(view: CardView, taskId: string): TemplateCard;
/** The card fields a tap carries. */
export interface CardEvent {
    readonly eventKey?: string;
    readonly taskId?: string;
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
export declare function cardEventOf(body: unknown): CardEvent | undefined;
