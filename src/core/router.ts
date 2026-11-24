/**
 * Inbound routing.
 *
 * A thin facade over three collaborators: the chat's session memory
 * ({@link ChatState}), the prompts it is answering ({@link PromptBroker}) and the
 * commands it accepts ({@link ChatCommands}). Routing itself decides only where a
 * message belongs — everything else lives in the collaborator that owns it.
 */
import type { ChatText } from './chat-text.js'
import { ChatState } from './chat-state.js'
import { ChatCommands } from './commands.js'
import { PromptBroker } from './prompts.js'
import type { Clock, HostBridge, Logger } from './ports.js'
import type { ChannelRegistry } from './registry.js'
import type { Bindings } from './bindings.js'
import { APPROVE_WORDS, REJECT_WORDS } from './prompts.js'
import type { WaiterReply, Waiters } from './waiter.js'
import type {
  ApprovalOutcome, ApprovalView, ChannelId, InboundMessage, QuestionAnswer, QuestionView, TargetId,
} from './types.js'

export { APPROVE_WORDS, REJECT_WORDS, parseAnswers } from './prompts.js'

/** Everything the router drives. */
export interface RouterDeps {
  readonly registry: ChannelRegistry
  readonly bindings: Bindings
  readonly waiters: Waiters
  readonly host: HostBridge
  readonly clock: Clock
  readonly logger: Logger
  /** Chat wording for the configured chat language, resolved per call. */
  readonly text: () => ChatText
  /** Whether notifications append the reply hint. */
  readonly hintEnabled: () => boolean
}

/** Routes one inbound chat message to the part of the plugin that owns it. */
export class Router {
  readonly #deps: RouterDeps
  readonly #state = new ChatState()
  readonly #prompts: PromptBroker
  readonly #commands: ChatCommands

  /** @param deps - registry, stores and host session operations. */
  constructor(deps: RouterDeps) {
    this.#deps = deps
    this.#prompts = new PromptBroker({
      registry: deps.registry,
      waiters: deps.waiters,
      clock: deps.clock,
      text: deps.text,
      state: this.#state,
    })
    this.#commands = new ChatCommands({
      registry: deps.registry,
      host: deps.host,
      text: deps.text,
      state: this.#state,
    })
  }

  /** Number of answerable prompts (diagnostics). */
  get pendingCount(): number {
    return this.#prompts.pendingCount
  }

  /** Remember the session a pushed notification belongs to. */
  noteNotification(channel: ChannelId, target: TargetId, sessionId?: string): void {
    const now = this.#deps.clock.now()
    this.#deps.bindings.set(channel, target, sessionId, now)
    if (sessionId !== undefined) {
      this.#state.setCurrent(sessionId)
      this.#deps.bindings.noteSession(sessionId)
    }
  }

  /** Label a session by its workspace for receipts. */
  labelSession(sessionId: string, workspace?: string): void {
    if (workspace !== undefined) this.#state.setLabel(sessionId, workspace)
  }

  /** Offer one approval to the chat; null when another surface answered. */
  async onApproval(view: ApprovalView): Promise<ApprovalOutcome | null> {
    return this.#prompts.onApproval(view)
  }

  /** Offer one question batch to the chat; null when another surface answered. */
  async onQuestion(view: QuestionView): Promise<QuestionAnswer | null> {
    return this.#prompts.onQuestion(view)
  }

  /** Another surface answered first: release the prompt. */
  drop(kind: 'approval' | 'question', sessionId: string, callId?: string): void {
    this.#prompts.drop(kind, sessionId, callId)
  }

  /** Hold a send open until a reply arrives on one channel. */
  async awaitReply(channel: ChannelId, targets: readonly TargetId[], timeoutMs: number, signal?: AbortSignal): Promise<WaiterReply | null> {
    return this.#prompts.awaitReply(channel, targets, timeoutMs, signal)
  }

  /**
   * Route one inbound message.
   * @param inbound - the normalized message.
   */
  async route(inbound: InboundMessage): Promise<void> {
    const channel = this.#deps.registry.get(inbound.channel)
    if (channel === undefined || !channel.interactive) return
    const reply = inbound.text.trim()
    if (reply.length === 0) return

    if (reply.startsWith('/')) {
      await this.#commands.run(inbound, reply)
      return
    }

    if (this.#deps.waiters.settle(inbound.channel, inbound.target, reply, inbound.at)) return
    if (await this.#prompts.answer(inbound, reply)) return

    // A stray approve/reject must never become conversation input.
    const word = reply.toLowerCase()
    if (APPROVE_WORDS.has(word) || REJECT_WORDS.has(word)) {
      await this.#receipt(inbound, this.#deps.text().noPendingApproval)
      return
    }
    await this.#continueConversation(inbound, reply)
  }

  /** Release every pending prompt and wait. */
  dispose(): void {
    this.#prompts.dispose()
    this.#deps.waiters.dispose()
  }

  /** Hand one free-form reply to the session the chat is talking to. */
  async #continueConversation(inbound: InboundMessage, reply: string): Promise<void> {
    const text = this.#deps.text()
    const now = this.#deps.clock.now()
    const bound = this.#deps.bindings.get(inbound.channel, inbound.target, now)
    const sessionId = bound ?? this.#state.current() ?? this.#deps.bindings.lastSession
    if (sessionId === undefined) {
      await this.#receipt(inbound, text.noSession)
      return
    }
    const result = await this.#deps.host.prompt(sessionId, reply)
    if (result.ok) {
      this.#state.setCurrent(sessionId)
      this.#deps.bindings.set(inbound.channel, inbound.target, sessionId, now)
      await this.#receipt(inbound, text.sentTo(this.#state.label(sessionId)))
      return
    }
    await this.#receipt(inbound, text.sendFailed(result.error ?? 'unknown error'))
  }

  async #receipt(inbound: InboundMessage, text: string): Promise<void> {
    await this.#deps.registry.pushText(inbound.channel, inbound.target, text)
  }
}
