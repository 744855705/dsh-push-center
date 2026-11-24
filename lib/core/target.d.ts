/** Recipient resolution shared by every channel. */
import type { Capabilities, ChannelSettings, KnownTarget, TargetId } from './types.js';
/** How long a conversation counts as recently active for default routing. */
export declare const RECENT_TARGET_MS: number;
/**
 * Resolve who a message goes to, in the documented order:
 * explicit target, the channel's configured defaults, conversations heard from
 * in the last day, every known conversation, nothing.
 *
 * @param settings - the channel's conversation settings.
 * @param capabilities - the channel's addressing model.
 * @param known - conversations the channel has heard from.
 * @param explicit - a caller-supplied target, when one was given.
 * @param now - current epoch milliseconds.
 * @returns the resolved targets; empty means nothing can be delivered.
 */
export declare function resolveTargets(settings: ChannelSettings, capabilities: Capabilities, known: readonly KnownTarget[], explicit?: TargetId, now?: number): TargetId[];
/**
 * Record one inbound conversation, keeping the newest 64 and moving a repeat to
 * the front so "most recent" stays meaningful.
 *
 * @param known - current known conversations.
 * @param id - the conversation that just spoke.
 * @param now - current epoch milliseconds.
 * @param label - optional display label.
 * @returns the updated list, newest first.
 */
export declare function rememberTarget(known: readonly KnownTarget[], id: TargetId, now: number, label?: string): KnownTarget[];
