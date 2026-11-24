import type { NotifyEventType } from './notifier.js';
/** How long a page counts as "open" after its last poll or its live stream. */
export declare const RENDERER_HEARTBEAT_MS = 10000;
/** How long an undelivered event waits for a page. */
export declare const RENDERER_EVENT_TTL_MS = 60000;
/** One event handed to an open page. */
export interface RendererEvent {
    /** Monotonic id; a page sends it back as its cursor. */
    readonly id: string;
    readonly type: NotifyEventType;
    readonly title: string;
    readonly body: string;
    readonly at: number;
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
export declare function shouldHandle(eventId: string, memoryCursor: string, storedCursor: string): boolean;
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
export declare function readDrain(payload: unknown, current: string): {
    events: RendererEvent[];
    cursor: string;
};
/** Where one system notification should go. */
export type NotificationRoute = 'renderer' | 'host' | 'drop';
/** Configuration facts the route decision needs. */
export interface RouteInput {
    readonly backend: 'auto' | 'renderer' | 'host';
    /** `process.platform` of the host. */
    readonly platform: NodeJS.Platform | string;
    /** Milliseconds since the page last polled or held its stream open. */
    readonly heartbeatAgeMs: number;
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
export declare function chooseRoute(input: RouteInput): NotificationRoute;
/**
 * A bounded queue of system notifications for the open page.
 *
 * The queue is the only bridge to the page: a long-lived stream drains it live,
 * a polling page drains it with a cursor, and an event nobody collects expires.
 * Nothing here runs unless a notification is raised or a page asks.
 */
export declare class RendererQueue {
    #private;
    /** @param now - clock override for tests. */
    constructor(now?: () => number);
    /** Record that a page is live right now. */
    touch(): void;
    /** Milliseconds since the last page contact; Infinity when no page ever called. */
    heartbeatAgeMs(): number;
    /** Whether an open page is owed events right now. */
    get pageOpen(): boolean;
    /**
     * Queue one event for the page, dropping anything past its TTL.
     * Live subscribers receive it immediately.
     * @param input - the event to hand over.
     * @returns the queued event with its id.
     */
    enqueue(input: {
        type: NotifyEventType;
        title: string;
        body: string;
    }): RendererEvent;
    /**
     * Drain everything after a page's cursor.
     * An unknown or absent cursor starts from now, so a reload never replays history.
     * @param cursor - the last event id the page handled.
     * @returns the new events and the cursor to send next time.
     */
    since(cursor: string | undefined): {
        events: readonly RendererEvent[];
        cursor: string;
    };
    /**
     * Follow events live (the SSE path).
     * @param listener - called for each new event.
     * @returns the unsubscribe function.
     */
    subscribe(listener: (event: RendererEvent) => void): () => void;
    /** Drop every queued event (profile reload). */
    clear(): void;
}
