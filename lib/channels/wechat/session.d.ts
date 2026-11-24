import type { KnownTarget } from '../../core/types.js';
/** Stored shape. */
export interface WechatSessionFile {
    readonly botToken?: string;
    /** Base URL the server assigned to this bot session. */
    readonly baseUrl?: string;
    /** Long-poll cursor, so a restart does not replay old messages. */
    readonly updatesBuf?: string;
    readonly contexts: Record<string, string>;
    readonly targets: KnownTarget[];
}
/** Session state with the JSON document underneath it. */
export declare class WechatSession {
    #private;
    /** @param path - absolute session file path. */
    constructor(path: string);
    /** Load the file, tolerating a missing or malformed one. */
    load(): Promise<void>;
    /** Persist the current state. */
    save(): Promise<void>;
    /** The bot token, when logged in. */
    get botToken(): string | undefined;
    /** The bot session base URL, when the server assigned one. */
    get baseUrl(): string | undefined;
    /** The long-poll cursor. */
    get updatesBuf(): string | undefined;
    /** Known conversations, newest first. */
    get targets(): readonly KnownTarget[];
    /** Context token captured for one conversation. */
    contextOf(user: string): string | undefined;
    /**
     * Replace the bot token (login/relogin) and forget the cursor bound to the old one.
     * @param token - the new token, or undefined to log out.
     */
    setBotToken(token: string | undefined): Promise<void>;
    /**
     * Store the base URL assigned by the server.
     * @param url - the base URL.
     */
    setBaseUrl(url: string): Promise<void>;
    /**
     * Store the long-poll cursor.
     * @param cursor - the cursor returned by getupdates.
     */
    setUpdatesBuf(cursor: string): Promise<void>;
    /**
     * Forget one conversation context token (the server rejected it).
     * @param user - the conversation id.
     */
    forgetContext(user: string): Promise<void>;
    /**
     * Remember a conversation and its context token.
     * @param user - the conversation id.
     * @param contextToken - token captured from the inbound message.
     * @param now - arrival time.
     * @returns whether anything changed and was persisted.
     */
    remember(user: string, contextToken: string | undefined, now: number): Promise<boolean>;
}
