/** Persisted WeChat login state: bot token, per-user context tokens, known users. */
import { JsonDocument } from '../../core/store.js'
import type { KnownTarget } from '../../core/types.js'

/** Stored shape. */
export interface WechatSessionFile {
  readonly botToken?: string
  /** Base URL the server assigned to this bot session. */
  readonly baseUrl?: string
  /** Long-poll cursor, so a restart does not replay old messages. */
  readonly updatesBuf?: string
  readonly contexts: Record<string, string>
  readonly targets: KnownTarget[]
}

/** Session state with the JSON document underneath it. */
export class WechatSession {
  readonly #document: JsonDocument<WechatSessionFile>
  #value: WechatSessionFile = { contexts: {}, targets: [] }

  /** @param path - absolute session file path. */
  constructor(path: string) {
    this.#document = new JsonDocument<WechatSessionFile>(path, () => ({ contexts: {}, targets: [] }))
  }

  /** Load the file, tolerating a missing or malformed one. */
  async load(): Promise<void> {
    const stored = await this.#document.read()
    this.#value = {
      ...(typeof stored.botToken === 'string' ? { botToken: stored.botToken } : {}),
      ...(typeof stored.baseUrl === 'string' ? { baseUrl: stored.baseUrl } : {}),
      ...(typeof stored.updatesBuf === 'string' ? { updatesBuf: stored.updatesBuf } : {}),
      contexts: stored.contexts ?? {},
      targets: Array.isArray(stored.targets) ? stored.targets : [],
    }
  }

  /** Persist the current state. */
  async save(): Promise<void> {
    await this.#document.write(this.#value)
  }

  /** The bot token, when logged in. */
  get botToken(): string | undefined {
    return this.#value.botToken
  }

  /** The bot session base URL, when the server assigned one. */
  get baseUrl(): string | undefined {
    return this.#value.baseUrl
  }

  /** The long-poll cursor. */
  get updatesBuf(): string | undefined {
    return this.#value.updatesBuf
  }

  /** Known conversations, newest first. */
  get targets(): readonly KnownTarget[] {
    return this.#value.targets
  }

  /** Context token captured for one conversation. */
  contextOf(user: string): string | undefined {
    return this.#value.contexts[user]
  }

  /**
   * Replace the bot token (login/relogin) and forget the cursor bound to the old one.
   * @param token - the new token, or undefined to log out.
   */
  async setBotToken(token: string | undefined): Promise<void> {
    const { botToken: _previous, updatesBuf: _cursor, ...rest } = this.#value
    this.#value = token === undefined ? rest : { ...rest, botToken: token }
    await this.save()
  }

  /**
   * Store the base URL assigned by the server.
   * @param url - the base URL.
   */
  async setBaseUrl(url: string): Promise<void> {
    this.#value = { ...this.#value, baseUrl: url }
    await this.save()
  }

  /**
   * Store the long-poll cursor.
   * @param cursor - the cursor returned by getupdates.
   */
  async setUpdatesBuf(cursor: string): Promise<void> {
    this.#value = { ...this.#value, updatesBuf: cursor }
    await this.save()
  }

  /**
   * Forget one conversation context token (the server rejected it).
   * @param user - the conversation id.
   */
  async forgetContext(user: string): Promise<void> {
    if (this.#value.contexts[user] === undefined) return
    const contexts = { ...this.#value.contexts }
    delete contexts[user]
    this.#value = { ...this.#value, contexts }
    await this.save()
  }

  /**
   * Remember a conversation and its context token.
   * @param user - the conversation id.
   * @param contextToken - token captured from the inbound message.
   * @param now - arrival time.
   * @returns whether anything changed and was persisted.
   */
  async remember(user: string, contextToken: string | undefined, now: number): Promise<boolean> {
    const known = this.#value.targets.some((target) => target.id === user)
    const targets = known
      ? this.#value.targets
      : [{ id: user, lastSeenAt: now }, ...this.#value.targets].slice(0, 64)
    const contexts = contextToken === undefined
      ? this.#value.contexts
      : { ...this.#value.contexts, [user]: contextToken }
    const changed = !known || (contextToken !== undefined && this.#value.contexts[user] !== contextToken)
    this.#value = { ...this.#value, targets, contexts }
    if (changed) await this.save()
    return changed
  }
}
