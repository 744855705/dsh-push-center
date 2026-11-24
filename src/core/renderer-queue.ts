/** Events owed to an open page, and the routing decision between page and OS. */
import { hostNotifierAvailable } from './platform.js'
import type { NotifyEventType } from './notifier.js'

/** How long a page counts as "open" after its last poll or its live stream. */
export const RENDERER_HEARTBEAT_MS = 10_000

/** How long an undelivered event waits for a page. */
export const RENDERER_EVENT_TTL_MS = 60_000

/** Upper bound on queued events, so a forgotten profile cannot grow without limit. */
const MAX_EVENTS = 50

/** One event handed to an open page. */
export interface RendererEvent {
  /** Monotonic id; a page sends it back as its cursor. */
  readonly id: string
  readonly type: NotifyEventType
  readonly title: string
  readonly body: string
  readonly at: number
}

/**
 * Whether the page should act on one event.
 *
 * Two cursors guard it: the page's own in-memory one, and the one persisted in
 * storage (which a second tab also writes). Both are checked because a poll and
 * the page's own re-delivery can race within the same tick.
 * @param eventId - the event being considered.
 * @param memoryCursor - the last id this page instance handled.
 * @param storedCursor - the last id persisted for this origin.
 * @returns true when the event still needs handling.
 */
export function shouldHandle(eventId: string, memoryCursor: string, storedCursor: string): boolean {
  return eventId.length > 0 && eventId !== memoryCursor && eventId !== storedCursor
}

/**
 * Read one poll response.
 *
 * Kept pure and shared with the page: the page must handle the events it
 * receives *before* adopting the cursor, otherwise a response carrying a single
 * event looks already-seen and is dropped.
 * @param payload - the `system.poll` result value.
 * @param current - the cursor the page sent.
 * @returns the events to handle and the cursor to use next.
 */
export function readDrain(payload: unknown, current: string): { events: RendererEvent[]; cursor: string } {
  const value = payload as { events?: unknown; cursor?: unknown } | undefined
  const events = Array.isArray(value?.events) ? (value.events as RendererEvent[]) : []
  const cursor = typeof value?.cursor === 'string' && value.cursor.length > 0 ? value.cursor : current
  return { events, cursor }
}

/** Where one system notification should go. */
export type NotificationRoute = 'renderer' | 'host' | 'drop'

/** Configuration facts the route decision needs. */
export interface RouteInput {
  readonly backend: 'auto' | 'renderer' | 'host'
  /** `process.platform` of the host. */
  readonly platform: NodeJS.Platform | string
  /** Milliseconds since the page last polled or held its stream open. */
  readonly heartbeatAgeMs: number
}

/**
 * Decide which path carries one system notification.
 *
 * There is no fallback from renderer to host: a page that is open is the correct
 * identity everywhere, and macOS has no usable host identity at all. `auto`
 * therefore means "the page when one is open, else the OS command where it works".
 * @param input - configured backend, platform and page liveness.
 * @returns the chosen route.
 */
export function chooseRoute(input: RouteInput): NotificationRoute {
  const hostWorks = hostNotifierAvailable(input.platform)
  if (input.backend === 'renderer') return 'renderer'
  if (input.backend === 'host') return hostWorks ? 'host' : 'drop'
  if (input.heartbeatAgeMs < RENDERER_HEARTBEAT_MS) return 'renderer'
  return hostWorks ? 'host' : 'drop'
}

/** One event plus whether some page has already taken it. */
interface QueuedEvent {
  readonly event: RendererEvent
  claimed: boolean
}

/**
 * A bounded queue of system notifications for the page.
 *
 * Delivery is **at most once**: whoever claims an event takes it off the queue,
 * so a second page asking at the same moment gets nothing. That is what makes
 * several open pages safe without restricting any of them. A live stream (SSE)
 * is served first; polling pages pick up whatever it did not take.
 */
export class RendererQueue {
  readonly #now: () => number
  #events: QueuedEvent[] = []
  #heartbeatAt = 0
  #seq = 0
  readonly #subscribers = new Set<(event: RendererEvent) => void>()

  /** @param now - clock override for tests. */
  constructor(now: () => number = () => Date.now()) {
    this.#now = now
  }

  /** Record that a page is live right now. */
  touch(): void {
    this.#heartbeatAt = this.#now()
  }

  /** Milliseconds since the last page contact; Infinity when no page ever called. */
  heartbeatAgeMs(): number {
    if (this.#heartbeatAt === 0) return Number.POSITIVE_INFINITY
    return Math.max(0, this.#now() - this.#heartbeatAt)
  }

  /** Whether an open page is owed events right now. */
  get pageOpen(): boolean {
    return this.heartbeatAgeMs() < RENDERER_HEARTBEAT_MS
  }

  /**
   * Queue one event for a page, dropping anything past its TTL.
   *
   * A live subscriber takes it immediately — it is the consumer for the moment.
   * @param input - the event to hand over.
   * @returns the event with its id.
   */
  enqueue(input: { type: NotifyEventType; title: string; body: string }): RendererEvent {
    const now = this.#now()
    this.#seq += 1
    const event: RendererEvent = {
      id: `${String(now)}-${String(this.#seq)}`,
      type: input.type,
      title: input.title,
      body: input.body,
      at: now,
    }
    this.#trim(now)
    const [streamer] = [...this.#subscribers]
    if (streamer !== undefined) {
      streamer(event)
      return event
    }
    this.#events = [...this.#events, { event, claimed: false }].slice(-MAX_EVENTS)
    return event
  }

  /**
   * Take every unclaimed event.
   *
   * Each event is handed out exactly once; the cursor is reported back for the
   * page's own de-duplication but no longer selects what is returned.
   * @param cursor - the last event id the page handled.
   * @returns the events this call claimed, and the cursor to send next time.
   */
  claim(cursor: string | undefined): { events: readonly RendererEvent[]; cursor: string } {
    const now = this.#now()
    this.#trim(now)
    const claimed: RendererEvent[] = []
    this.#events = this.#events.map((item) => {
      if (item.claimed) return item
      claimed.push(item.event)
      return { event: item.event, claimed: true }
    })
    return { events: claimed, cursor: this.#cursor(cursor) }
  }

  /** How many events are still waiting to be taken. */
  pending(): number {
    this.#trim(this.#now())
    return this.#events.reduce((count, item) => count + (item.claimed ? 0 : 1), 0)
  }

  /**
   * Follow events live (the SSE path).
   * @param listener - called for each new event; only the first subscriber receives.
   * @returns the unsubscribe function.
   */
  subscribe(listener: (event: RendererEvent) => void): () => void {
    this.#subscribers.add(listener)
    this.touch()
    return () => {
      this.#subscribers.delete(listener)
    }
  }

  /** The newest id, so a page knows where it stands. */
  #cursor(fallback: string | undefined): string {
    return this.#events.at(-1)?.event.id ?? fallback ?? ''
  }

  /** Drop expired events. */
  #trim(now: number): void {
    this.#events = this.#events.filter((item) => now - item.event.at <= RENDERER_EVENT_TTL_MS)
  }

  /** Drop every queued event (profile reload). */
  clear(): void {
    this.#events = []
    this.#heartbeatAt = 0
  }
}
