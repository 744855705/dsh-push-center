/** The extension contract: one bot channel = one subclass. */
import type { Clock, HttpClient, Logger } from './ports.js'
import { errorCode, errorMessage } from './errors.js'
import { resolveTargets } from './target.js'
import type {
  Capabilities, ChannelId, ChannelSettings, ChannelStatus, DeliveredResult, DeliveryResult,
  InboundMessage, KnownTarget, OutboundMessage, RenderedMessage, SendOptions, SendReport, TargetId,
} from './types.js'

/** Dependencies every channel may use; injected once at open(). */
export interface ChannelRuntime {
  readonly logger: Logger
  readonly clock: Clock
  readonly http: HttpClient
  /** Directory this channel may keep its own session file in. */
  readonly dataDir: string
  /** Hand a normalized inbound message to the router. */
  readonly onInbound: (message: InboundMessage) => void
  /** Record outbound outcomes for the delivery ledger; optional in tests. */
  readonly logDelivery?: (deliveries: readonly DeliveredResult[]) => void
}

/**
 * Base class for every bot channel.
 *
 * Subclasses decide how to connect (`open`/`close`), how a message looks
 * (`render`) and how it travels (`transmit`). Everything else - target
 * resolution, fan-out, failure isolation, inbound normalization - is final here,
 * so a new bot type never re-implements routing.
 */
export abstract class PushChannel {
  abstract readonly id: ChannelId
  abstract readonly capabilities: Capabilities
  abstract readonly settings: ChannelSettings

  #runtime: ChannelRuntime | undefined

  /** Open the connection. Called once at mount and after every config change. */
  abstract open(runtime: ChannelRuntime): Promise<void>

  /** Close the connection and release timers/sockets. */
  abstract close(): Promise<void>

  /** Observable state for the settings page and routing. */
  abstract get status(): ChannelStatus

  /** Whether the channel has everything it needs (credentials, URLs). */
  abstract get configured(): boolean

  /** Turn a domain message into the channel's own shape. Must be pure. */
  protected abstract render(message: OutboundMessage): RenderedMessage

  /** Deliver one rendered message to one target; failures come back as results. */
  protected abstract transmit(
    target: TargetId | null,
    message: RenderedMessage,
    signal: AbortSignal,
  ): Promise<DeliveryResult>

  /** The runtime, or undefined before open(); for best-effort logging. */
  protected get optionalRuntime(): ChannelRuntime | undefined {
    return this.#runtime
  }

  /** The injected runtime; throws when a subclass transmits before open(). */
  protected get runtime(): ChannelRuntime {
    if (this.#runtime === undefined) throw new Error(`channel ${this.id} used before open`)
    return this.#runtime
  }

  /** Attach the runtime exactly once. */
  async start(runtime: ChannelRuntime): Promise<void> {
    this.#runtime = runtime
    await this.open(runtime)
  }

  /** Whether the channel should receive traffic. */
  get enabled(): boolean {
    return this.settings.enabled
  }

  /** Whether the channel is enabled, configured and not in a failed state. */
  get usable(): boolean {
    const state = this.status.state
    return this.enabled && this.configured && (state === 'ready' || state === 'degraded')
  }

  /**
   * Whether an unconfigured default may pick this channel.
   * Notification-only channels (the OS notifier) opt out so automatic pushes
   * never leak into them.
   */
  readonly autoSelectable: boolean = true

  /** Whether replies from this channel may drive interactions. */
  get interactive(): boolean {
    return this.settings.interactive && this.capabilities.inbound
  }

  /** Conversations this channel has heard from, newest first. */
  get knownTargets(): readonly KnownTarget[] {
    return this.status.targets
  }

  /**
   * Resolve recipients for one send with the shared order.
   * @param explicit - a caller-supplied target.
   * @returns the targets to address.
   */
  resolveRecipients(explicit?: TargetId): TargetId[] {
    return resolveTargets(this.settings, this.capabilities, this.knownTargets, explicit, this.#runtime?.clock.now() ?? Date.now())
  }

  /**
   * Render once and deliver to every resolved target, isolating failures.
   * @param message - the domain message.
   * @param options - per-send overrides.
   * @returns what was delivered and why anything was skipped.
   */
  async send(message: OutboundMessage, options?: SendOptions): Promise<SendReport> {
    const targets = options?.targets ?? this.resolveRecipients(options?.target)
    if (targets.length === 0) {
      this.optionalRuntime?.logger.warn('[push] %s has no recipient: set defaultTargets or let the bot hear from someone first', this.id)
      this.optionalRuntime?.logDelivery?.([{ channel: this.id, target: null, ok: false, code: 'no-target', message: 'no recipient' }])
      return { delivered: [], skipped: [{ channel: this.id, reason: 'no-target' }] }
    }
    const rendered = this.render(message)
    const signal = options?.signal ?? new AbortController().signal
    const delivered = await Promise.all(targets.map(async (target) => {
      const addressed = target.length === 0 ? null : target
      try {
        const result = await this.transmit(addressed, rendered, signal)
        return { ...result, channel: this.id, target: addressed }
      } catch (error) {
        return {
          ok: false,
          code: errorCode(error),
          message: errorMessage(error),
          channel: this.id,
          target: addressed,
        }
      }
    }))
    this.optionalRuntime?.logDelivery?.(delivered)
    return { delivered, skipped: [] }
  }

  /**
   * Hand one inbound text to the router, tagging it with this channel.
   * @param target - the conversation it came from.
   * @param text - the normalized text (buttons arrive as their vocabulary).
   */
  protected inbound(target: TargetId, text: string): void {
    const runtime = this.runtime
    runtime.onInbound({ channel: this.id, target, text, at: runtime.clock.now() })
  }
}
