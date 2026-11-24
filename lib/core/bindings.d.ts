/** Conversation bindings: which DSH session a chat conversation continues. */
import type { ChannelId, TargetId } from './types.js';
/** Lifetime of a binding; older bindings fall back to the last notified session. */
export declare const BINDING_TTL_MS: number;
/**
 * Per-conversation session bindings.
 *
 * A binding is written whenever a message goes out for a session, so a reply
 * from that conversation continues the session it was notified about instead of
 * the most recent one globally.
 */
export declare class Bindings {
    #private;
    /**
     * Bind one conversation to a session.
     * @param channel - the channel id.
     * @param target - the conversation id.
     * @param sessionId - the session it now continues.
     * @param now - current epoch milliseconds.
     */
    set(channel: ChannelId, target: TargetId, sessionId: string | undefined, now: number): void;
    /**
     * The session one conversation continues.
     * @param channel - the channel id.
     * @param target - the conversation id.
     * @param now - current epoch milliseconds.
     * @returns the session id, or undefined when unknown or expired.
     */
    get(channel: ChannelId, target: TargetId, now: number): string | undefined;
    /** Remember the newest session that produced a notification. */
    noteSession(sessionId: string | undefined): void;
    /** The newest session that produced a notification. */
    get lastSession(): string | undefined;
}
