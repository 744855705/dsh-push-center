/** What the chat side remembers about sessions: which one is current, and its labels. */
export class ChatState {
    #current;
    #labels = new Map();
    /** The session the chat is currently talking to, if any. */
    current() {
        return this.#current;
    }
    /** Point the chat at one session. */
    setCurrent(sessionId) {
        this.#current = sessionId;
    }
    /** Remember the workspace name of a session, for receipts and menus. */
    setLabel(sessionId, workspace) {
        this.#labels.set(sessionId, workspace);
    }
    /** Workspace name of a session, or '' when unknown. */
    workspace(sessionId) {
        return this.#labels.get(sessionId) ?? '';
    }
    /** Bracketed label for receipts: `[workspace] `, or '' when unknown. */
    label(sessionId) {
        const workspace = this.workspace(sessionId);
        return workspace.length === 0 ? '' : `[${workspace}] `;
    }
}
//# sourceMappingURL=chat-state.js.map