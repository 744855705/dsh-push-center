/** Lifetime of a binding; older bindings fall back to the last notified session. */
export const BINDING_TTL_MS = 12 * 60 * 60_000;
/**
 * Per-conversation session bindings.
 *
 * A binding is written whenever a message goes out for a session, so a reply
 * from that conversation continues the session it was notified about instead of
 * the most recent one globally.
 */
export class Bindings {
    #byTarget = new Map();
    #lastSessionId;
    /**
     * Bind one conversation to a session.
     * @param channel - the channel id.
     * @param target - the conversation id.
     * @param sessionId - the session it now continues.
     * @param now - current epoch milliseconds.
     */
    set(channel, target, sessionId, now) {
        this.#byTarget.set(`${channel}\u0000${target}`, { sessionId, at: now });
        if (sessionId !== undefined)
            this.#lastSessionId = sessionId;
    }
    /**
     * The session one conversation continues.
     * @param channel - the channel id.
     * @param target - the conversation id.
     * @param now - current epoch milliseconds.
     * @returns the session id, or undefined when unknown or expired.
     */
    get(channel, target, now) {
        const binding = this.#byTarget.get(`${channel}\u0000${target}`);
        if (binding === undefined)
            return undefined;
        if (now - binding.at > BINDING_TTL_MS) {
            this.#byTarget.delete(`${channel}\u0000${target}`);
            return undefined;
        }
        return binding.sessionId;
    }
    /** Remember the newest session that produced a notification. */
    noteSession(sessionId) {
        if (sessionId !== undefined)
            this.#lastSessionId = sessionId;
    }
    /** The newest session that produced a notification. */
    get lastSession() {
        return this.#lastSessionId;
    }
}
//# sourceMappingURL=bindings.js.map