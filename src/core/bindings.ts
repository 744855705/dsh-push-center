/** Conversation bindings: which DSH session a chat conversation continues. */
import type { ChannelId, TargetId } from './types.js'

/** Lifetime of a binding; older bindings fall back to the last notified session. */
export const BINDING_TTL_MS = 12 * 60 * 60_000

interface Binding {
  readonly sessionId: string | undefined
  readonly at: number
}

/**
 * Per-conversation session bindings.
 *
 * A binding is written whenever a message goes out for a session, so a reply
 * from that conversation continues the session it was notified about instead of
 * the most recent one globally.
 */
export class Bindings {
  readonly #byTarget = new Map<string, Binding>()
  #lastSessionId: string | undefined

  /**
   * Bind one conversation to a session.
   * @param channel - the channel id.
   * @param target - the conversation id.
   * @param sessionId - the session it now continues.
   * @param now - current epoch milliseconds.
   */
  set(channel: ChannelId, target: TargetId, sessionId: string | undefined, now: number): void {
    this.#byTarget.set(`${channel}\u0000${target}`, { sessionId, at: now })
    if (sessionId !== undefined) this.#lastSessionId = sessionId
  }

  /**
   * The session one conversation continues.
   * @param channel - the channel id.
   * @param target - the conversation id.
   * @param now - current epoch milliseconds.
   * @returns the session id, or undefined when unknown or expired.
   */
  get(channel: ChannelId, target: TargetId, now: number): string | undefined {
    const binding = this.#byTarget.get(`${channel}\u0000${target}`)
    if (binding === undefined) return undefined
    if (now - binding.at > BINDING_TTL_MS) {
      this.#byTarget.delete(`${channel}\u0000${target}`)
      return undefined
    }
    return binding.sessionId
  }

  /** Remember the newest session that produced a notification. */
  noteSession(sessionId: string | undefined): void {
    if (sessionId !== undefined) this.#lastSessionId = sessionId
  }

  /** The newest session that produced a notification. */
  get lastSession(): string | undefined {
    return this.#lastSessionId
  }
}
