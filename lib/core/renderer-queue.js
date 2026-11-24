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
 * A bounded queue of system notifications for the open page.
 *
 * The queue is the only bridge to the page: a long-lived stream drains it live,
 * a polling page drains it with a cursor, and an event nobody collects expires.
 * Nothing here runs unless a notification is raised or a page asks.
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
     * Queue one event for the page, dropping anything past its TTL.
     * Live subscribers receive it immediately.
     * @param input - the event to hand over.
     * @returns the queued event with its id.
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
        this.#events = [...this.#events, event]
            .filter((item) => now - item.at <= RENDERER_EVENT_TTL_MS)
            .slice(-MAX_EVENTS);
        for (const listener of this.#subscribers)
            listener(event);
        return event;
    }
    /**
     * Drain everything after a page's cursor.
     * An unknown or absent cursor starts from now, so a reload never replays history.
     * @param cursor - the last event id the page handled.
     * @returns the new events and the cursor to send next time.
     */
    since(cursor) {
        const now = this.#now();
        this.#events = this.#events.filter((item) => now - item.at <= RENDERER_EVENT_TTL_MS);
        const last = this.#events.at(-1);
        const nextCursor = last?.id ?? cursor ?? '';
        // An unknown cursor means the page is new, or the host restarted and its ids
        // changed. Queued events are then still owed to it: a duplicate is harmless
        // (the page de-duplicates by id), a lost notification is not.
        if (cursor === undefined || cursor.length === 0)
            return { events: this.#events, cursor: nextCursor };
        const index = this.#events.findIndex((item) => item.id === cursor);
        if (index === -1)
            return { events: this.#events, cursor: nextCursor };
        return { events: this.#events.slice(index + 1), cursor: nextCursor };
    }
    /**
     * Follow events live (the SSE path).
     * @param listener - called for each new event.
     * @returns the unsubscribe function.
     */
    subscribe(listener) {
        this.#subscribers.add(listener);
        this.touch();
        return () => {
            this.#subscribers.delete(listener);
        };
    }
    /** Drop every queued event (profile reload). */
    clear() {
        this.#events = [];
        this.#heartbeatAt = 0;
    }
}
//# sourceMappingURL=renderer-queue.js.map