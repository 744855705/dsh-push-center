/** Domain service: turn an event into a routed push. */
import type { ChatText } from './chat-text.js';
import type { ChannelRegistry } from './registry.js';
import type { Router } from './router.js';
import type { Clock, Logger } from './ports.js';
import type { DeliveredResult, SendReport } from './types.js';
/** Notification kinds the plugin emits. */
export type NotifyEventType = 'conversationCompleted' | 'conversationPaused' | 'conversationFailed' | 'authorizationRequired' | 'confirmationRequired' | 'todoProgress';
/** One domain event, already worded by the caller. */
export interface NotifyEvent {
    readonly type: NotifyEventType;
    readonly title: string;
    readonly body: string;
    readonly sessionId?: string;
    readonly workspace?: string;
}
/** Configuration facts the notifier reads at call time. */
export interface NotifierPolicy {
    enabled(): boolean;
    events(): Readonly<Record<NotifyEventType, boolean>>;
    titlePrefix(): string;
    hint(): boolean;
    /** Channels event notifications go to; empty means the default channel. */
    channels(): readonly string[];
    text(): ChatText;
    /** System notifications: an independent switch set, never part of the chat fan-out. */
    system(): SystemRouting;
}
/** Everything the notifier reads to route one system notification. */
export interface SystemRouting {
    readonly enabled: boolean;
    readonly events: Readonly<Record<NotifyEventType, boolean>>;
    readonly backend: 'auto' | 'renderer' | 'host';
    /** `process.platform` of the host. */
    readonly platform: string;
    /** Hand one event to the open page. */
    enqueue(event: {
        type: NotifyEventType;
        title: string;
        body: string;
    }): void;
    /** Milliseconds since the page last checked in. */
    heartbeatAgeMs(): number;
}
/** Wiring the notifier needs. */
export interface NotifierDeps {
    readonly registry: ChannelRegistry;
    readonly router: Router;
    readonly clock: Clock;
    readonly logger: Logger;
    readonly policy: NotifierPolicy;
    /** Record a dropped system notification in the delivery ledger. */
    readonly noteDrop?: (row: DeliveredResult) => void;
}
/**
 * Formats and routes notification events.
 *
 * The notifier owns event filtering, the title prefix and the reply hint; the
 * registry owns channel selection; the router remembers which conversation saw
 * which session so the reply goes back to the right place.
 */
export declare class Notifier {
    #private;
    /** @param deps - registry, router and configuration accessors. */
    constructor(deps: NotifierDeps);
    /**
     * Push one event through the configured channels.
     * @param event - the event to push.
     * @returns the send report, or undefined when the event was filtered out.
     */
    emit(event: NotifyEvent): Promise<SendReport | undefined>;
}
