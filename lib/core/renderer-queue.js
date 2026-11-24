/** Events owed to an open page, and the routing decision between page and OS. */
import { hostNotifierAvailable } from './platform.js';
/** How long a page counts as "open" after its last poll or its live stream. */
export const RENDERER_HEARTBEAT_MS = 10_000;
/** How long an undelivered event waits for a page. */
export const RENDERER_EVENT_TTL_MS = 60_000;
/** Upper bound on queued events, so a forgotten profile cannot grow without limit. */
const MAX_EVENTS = 50;
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
export function shouldHandle(eventId, memoryCursor, storedCursor) {
    return eventId.length > 0 && eventId !== memoryCursor && eventId !== storedCursor;
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
export function readDrain(payload, current) {
    const value = payload;
    const events = Array.isArray(value?.events) ? value.events : [];
    const cursor = typeof value?.cursor === 'string' && value.cursor.length > 0 ? value.cursor : current;
    return { events, cursor };
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
export function chooseRoute(input) {
    const hostWorks = hostNotifierAvailable(input.platform);
    if (input.backend === 'renderer')
        return 'renderer';
    if (input.backend === 'host')
        return hostWorks ? 'host' : 'drop';
    if (input.heartbeatAgeMs < RENDERER_HEARTBEAT_MS)
        return 'renderer';
    return hostWorks ? 'host' : 'drop';
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
    #now;
    #events = [];
    #heartbeatAt = 0;
    #seq = 0;
    #subscribers = new Set();
    /** @param now - clock override for tests. */
    constructor(now = () => Date.now()) {
        this.#now = now;
    }
    /** Record that a page is live right now. */
    touch() {
        this.#heartbeatAt = this.#now();
    }
    /** Milliseconds since the last page contact; Infinity when no page ever called. */
    heartbeatAgeMs() {
        if (this.#heartbeatAt === 0)
            return Number.POSITIVE_INFINITY;
        return Math.max(0, this.#now() - this.#heartbeatAt);
    }
    /** Whether an open page is owed events right now. */
    get pageOpen() {
        return this.heartbeatAgeMs() < RENDERER_HEARTBEAT_MS;
    }
    /**
     * Queue one event for a page, dropping anything past its TTL.
     *
     * A live subscriber takes it immediately — it is the consumer for the moment.
     * @param input - the event to hand over.
     * @returns the event with its id.
     */
    enqueue(input) {
        const now = this.#now();
        this.#seq += 1;
        const event = {
            id: `${String(now)}-${String(this.#seq)}`,
            type: input.type,
            title: input.title,
            body: input.body,
            at: now,
        };
        this.#trim(now);
        const [streamer] = [...this.#subscribers];
        if (streamer !== undefined) {
            streamer(event);
            return event;
        }
        this.#events = [...this.#events, { event, claimed: false }].slice(-MAX_EVENTS);
        return event;
    }
    /**
     * Take every unclaimed event.
     *
     * Each event is handed out exactly once; the cursor is reported back for the
     * page's own de-duplication but no longer selects what is returned.
     * @param cursor - the last event id the page handled.
     * @returns the events this call claimed, and the cursor to send next time.
     */
    claim(cursor) {
        const now = this.#now();
        this.#trim(now);
        const claimed = [];
        this.#events = this.#events.map((item) => {
            if (item.claimed)
                return item;
            claimed.push(item.event);
            return { event: item.event, claimed: true };
        });
        return { events: claimed, cursor: this.#cursor(cursor) };
    }
    /** How many events are still waiting to be taken. */
    pending() {
        this.#trim(this.#now());
        return this.#events.reduce((count, item) => count + (item.claimed ? 0 : 1), 0);
    }
    /**
     * Follow events live (the SSE path).
     * @param listener - called for each new event; only the first subscriber receives.
     * @returns the unsubscribe function.
     */
    subscribe(listener) {
        this.#subscribers.add(listener);
        this.touch();
        return () => {
            this.#subscribers.delete(listener);
        };
    }
    /** The newest id, so a page knows where it stands. */
    #cursor(fallback) {
        return this.#events.at(-1)?.event.id ?? fallback ?? '';
    }
    /** Drop expired events. */
    #trim(now) {
        this.#events = this.#events.filter((item) => now - item.event.at <= RENDERER_EVENT_TTL_MS);
    }
    /** Drop every queued event (profile reload). */
    clear() {
        this.#events = [];
        this.#heartbeatAt = 0;
    }
}
//# sourceMappingURL=renderer-queue.js.map