/** Persisted WeChat login state: bot token, per-user context tokens, known users. */
import { JsonDocument } from '../../core/store.js';
/** Session state with the JSON document underneath it. */
export class WechatSession {
    #document;
    #value = { contexts: {}, targets: [] };
    /** @param path - absolute session file path. */
    constructor(path) {
        this.#document = new JsonDocument(path, () => ({ contexts: {}, targets: [] }));
    }
    /** Load the file, tolerating a missing or malformed one. */
    async load() {
        const stored = await this.#document.read();
        this.#value = {
            ...(typeof stored.botToken === 'string' ? { botToken: stored.botToken } : {}),
            ...(typeof stored.baseUrl === 'string' ? { baseUrl: stored.baseUrl } : {}),
            ...(typeof stored.updatesBuf === 'string' ? { updatesBuf: stored.updatesBuf } : {}),
            contexts: stored.contexts ?? {},
            targets: Array.isArray(stored.targets) ? stored.targets : [],
        };
    }
    /** Persist the current state. */
    async save() {
        await this.#document.write(this.#value);
    }
    /** The bot token, when logged in. */
    get botToken() {
        return this.#value.botToken;
    }
    /** The bot session base URL, when the server assigned one. */
    get baseUrl() {
        return this.#value.baseUrl;
    }
    /** The long-poll cursor. */
    get updatesBuf() {
        return this.#value.updatesBuf;
    }
    /** Known conversations, newest first. */
    get targets() {
        return this.#value.targets;
    }
    /** Context token captured for one conversation. */
    contextOf(user) {
        return this.#value.contexts[user];
    }
    /**
     * Replace the bot token (login/relogin) and forget the cursor bound to the old one.
     * @param token - the new token, or undefined to log out.
     */
    async setBotToken(token) {
        const { botToken: _previous, updatesBuf: _cursor, ...rest } = this.#value;
        this.#value = token === undefined ? rest : { ...rest, botToken: token };
        await this.save();
    }
    /**
     * Store the base URL assigned by the server.
     * @param url - the base URL.
     */
    async setBaseUrl(url) {
        this.#value = { ...this.#value, baseUrl: url };
        await this.save();
    }
    /**
     * Store the long-poll cursor.
     * @param cursor - the cursor returned by getupdates.
     */
    async setUpdatesBuf(cursor) {
        this.#value = { ...this.#value, updatesBuf: cursor };
        await this.save();
    }
    /**
     * Forget one conversation context token (the server rejected it).
     * @param user - the conversation id.
     */
    async forgetContext(user) {
        if (this.#value.contexts[user] === undefined)
            return;
        const contexts = { ...this.#value.contexts };
        delete contexts[user];
        this.#value = { ...this.#value, contexts };
        await this.save();
    }
    /**
     * Remember a conversation and its context token.
     * @param user - the conversation id.
     * @param contextToken - token captured from the inbound message.
     * @param now - arrival time.
     * @returns whether anything changed and was persisted.
     */
    async remember(user, contextToken, now) {
        const known = this.#value.targets.some((target) => target.id === user);
        const targets = known
            ? this.#value.targets
            : [{ id: user, lastSeenAt: now }, ...this.#value.targets].slice(0, 64);
        const contexts = contextToken === undefined
            ? this.#value.contexts
            : { ...this.#value.contexts, [user]: contextToken };
        const changed = !known || (contextToken !== undefined && this.#value.contexts[user] !== contextToken);
        this.#value = { ...this.#value, targets, contexts };
        if (changed)
            await this.save();
        return changed;
    }
}
//# sourceMappingURL=session.js.map