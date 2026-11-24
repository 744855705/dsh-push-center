/** What the chat side remembers about sessions: which one is current, and its labels. */
export declare class ChatState {
    #private;
    /** The session the chat is currently talking to, if any. */
    current(): string | undefined;
    /** Point the chat at one session. */
    setCurrent(sessionId: string): void;
    /** Remember the workspace name of a session, for receipts and menus. */
    setLabel(sessionId: string, workspace: string): void;
    /** Workspace name of a session, or '' when unknown. */
    workspace(sessionId: string): string;
    /** Bracketed label for receipts: `[workspace] `, or '' when unknown. */
    label(sessionId: string): string;
}
