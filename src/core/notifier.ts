/** Domain service: turn an event into a routed push. */
import type { ChatText } from './chat-text.js'
import type { ChannelRegistry } from './registry.js'
import type { Router } from './router.js'
import type { Clock, Logger } from './ports.js'
import type { DeliveredResult, OutboundMessage, SendReport, SkipReason } from './types.js'
import { chooseRoute } from './renderer-queue.js'

/** Notification kinds the plugin emits. */
export type NotifyEventType =
  | 'conversationCompleted'
  | 'conversationPaused'
  | 'conversationFailed'
  | 'authorizationRequired'
  | 'confirmationRequired'
  | 'todoProgress'

/** One domain event, already worded by the caller. */
export interface NotifyEvent {
  readonly type: NotifyEventType
  readonly title: string
  readonly body: string
  readonly sessionId?: string
  readonly workspace?: string
}

/** Configuration facts the notifier reads at call time. */
export interface NotifierPolicy {
  enabled(): boolean
  events(): Readonly<Record<NotifyEventType, boolean>>
  titlePrefix(): string
  hint(): boolean
  /** Channels event notifications go to; empty means the default channel. */
  channels(): readonly string[]
  text(): ChatText
  /** System notifications: an independent switch set, never part of the chat fan-out. */
  system(): SystemRouting
}

/** Everything the notifier reads to route one system notification. */
export interface SystemRouting {
  readonly enabled: boolean
  readonly events: Readonly<Record<NotifyEventType, boolean>>
  readonly backend: 'auto' | 'renderer' | 'host'
  /** `process.platform` of the host. */
  readonly platform: string
  /** Hand one event to the open page. */
  enqueue(event: { type: NotifyEventType; title: string; body: string }): void
  /** Milliseconds since the page last checked in. */
  heartbeatAgeMs(): number
}

/** Wiring the notifier needs. */
export interface NotifierDeps {
  readonly registry: ChannelRegistry
  readonly router: Router
  readonly clock: Clock
  readonly logger: Logger
  readonly policy: NotifierPolicy
  /** Record a dropped system notification in the delivery ledger. */
  readonly noteDrop?: (row: DeliveredResult) => void
}

/**
 * Formats and routes notification events.
 *
 * The notifier owns event filtering, the title prefix and the reply hint; the
 * registry owns channel selection; the router remembers which conversation saw
 * which session so the reply goes back to the right place.
 */
export class Notifier {
  readonly #deps: NotifierDeps

  /** @param deps - registry, router and configuration accessors. */
  constructor(deps: NotifierDeps) {
    this.#deps = deps
  }

  /**
   * Push one event through the configured channels.
   * @param event - the event to push.
   * @returns the send report, or undefined when the event was filtered out.
   */
  async emit(event: NotifyEvent): Promise<SendReport | undefined> {
    const policy = this.#deps.policy
    if (!policy.enabled()) return undefined
    if (policy.events()[event.type] !== true) return undefined

    const prefix = policy.titlePrefix()
    const title = prefix.length > 0 && !event.title.startsWith(prefix) ? `${prefix} ${event.title}` : event.title
    const hint = policy.hint() ? `\n\n${policy.text().replyHint}` : ''
    const message: OutboundMessage = { kind: 'notice', title, body: `${event.body}${hint}` }

    const report = await this.#dispatch(message)
    const now = this.#deps.clock.now()
    for (const delivery of report.delivered) {
      if (!delivery.ok) continue
      this.#deps.router.noteNotification(delivery.channel, delivery.target ?? '', event.sessionId)
    }
    if (event.sessionId !== undefined && event.workspace !== undefined) {
      this.#deps.router.labelSession(event.sessionId, event.workspace)
    }
    if (report.delivered.length === 0 && report.skipped.length > 0) {
      const reasons = report.skipped.map((skip) => skip.channel + ':' + skip.reason).join(', ')
      this.#deps.logger.warn('[push] %s reached no channel (%s)', event.type, reasons)
    }
    if (report.delivered.every((delivery) => !delivery.ok) && report.delivered.length > 0) {
      this.#deps.logger.warn('[push] every channel failed for %s', event.type)
    }
    await this.#raiseSystemNotification(event, title)
    void now
    return report
  }

  /**
   * Raise the system notification when this event is ticked there.
   *
   * Deliberately separate from the chat dispatch: the system switch set is its
   * own, the body carries no reply hint, and a failure is only logged — a broken
   * notifier must never break the chat push that already happened.
   *
   * The route is decided at emit time: an open page receives the event through
   * the queue, and only where the OS has a usable identity does the host command
   * run. A route with nowhere to go is recorded, never silently swallowed.
   */
  async #raiseSystemNotification(event: NotifyEvent, title: string): Promise<void> {
    const system = this.#deps.policy.system()
    if (!system.enabled || system.events[event.type] !== true) return
    const route = chooseRoute({
      backend: system.backend,
      platform: system.platform,
      heartbeatAgeMs: system.heartbeatAgeMs(),
    })
    if (route === 'renderer') {
      system.enqueue({ type: event.type, title, body: event.body })
      return
    }
    if (route === 'drop') {
      this.#deps.logger.warn('[push] system notification dropped for %s: no page open and no host notifier on %s', event.type, system.platform)
      this.#deps.noteDrop?.({ channel: 'system', target: null, ok: false, code: 'renderer-absent', message: 'no page open and no host notifier on this platform' })
      return
    }
    const report = await this.#deps.registry.send({ kind: 'notice', title, body: event.body }, { channel: 'system' })
    for (const skip of report.skipped) {
      this.#deps.logger.warn('[push] system notification skipped for %s: %s', event.type, skip.reason)
    }
    for (const delivery of report.delivered) {
      if (delivery.ok) continue
      this.#deps.logger.warn('[push] system notification failed for %s: %s', event.type, delivery.message ?? delivery.code ?? 'unknown')
    }
  }

  async #dispatch(message: OutboundMessage): Promise<SendReport> {
    const wanted = this.#deps.policy.channels()
    // No explicit list: automatic delivery goes to the automatic recipient, which
    // falls back to the default channel and then to the first usable one.
    if (wanted.length === 0) return this.#deps.registry.sendAutomatic(message)
    const channels = wanted
      .map((id) => this.#deps.registry.get(id))
      .filter((channel): channel is NonNullable<typeof channel> => channel !== undefined && channel.usable)
    if (channels.length === 0) {
      const skipped: SkipReason[] = wanted.map((id) => ({ channel: id, reason: 'not-ready' }))
      return { delivered: [], skipped }
    }
    const reports = await Promise.all(channels.map((channel) => channel.send(message)))
    const delivered: DeliveredResult[] = reports.flatMap((report) => report.delivered)
    const skipped: SkipReason[] = reports.flatMap((report) => report.skipped)
    return { delivered, skipped }
  }
}
