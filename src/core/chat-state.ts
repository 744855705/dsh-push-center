/** What the chat side remembers about sessions: which one is current, and its labels. */
export class ChatState {
  #current: string | undefined
  readonly #labels = new Map<string, string>()

  /** The session the chat is currently talking to, if any. */
  current(): string | undefined {
    return this.#current
  }

  /** Point the chat at one session. */
  setCurrent(sessionId: string): void {
    this.#current = sessionId
  }

  /** Remember the workspace name of a session, for receipts and menus. */
  setLabel(sessionId: string, workspace: string): void {
    this.#labels.set(sessionId, workspace)
  }

  /** Workspace name of a session, or '' when unknown. */
  workspace(sessionId: string): string {
    return this.#labels.get(sessionId) ?? ''
  }

  /** Bracketed label for receipts: `[workspace] `, or '' when unknown. */
  label(sessionId: string): string {
    const workspace = this.workspace(sessionId)
    return workspace.length === 0 ? '' : `[${workspace}] `
  }
}
