import type { DeliveredResult } from './types.js';
/** One recorded outbound attempt. */
export interface DeliveryRecord {
    /** Epoch milliseconds of the attempt. */
    readonly at: number;
    readonly channel: string;
    /** '' for a webhook-style channel that has no addressable conversation. */
    readonly target: string;
    readonly ok: boolean;
    readonly code?: string;
    readonly message?: string;
}
/** Wiring for {@link DeliveryLog}. */
export interface DeliveryLogOptions {
    /** Absolute path of the persisted file. */
    readonly path: string;
    /** How many attempts to keep; newest first. Defaults to 50. */
    readonly limit?: number;
    /** Clock override for tests. */
    readonly now?: () => number;
}
/**
 * A bounded, newest-first ledger of outbound attempts.
 *
 * Every send that reaches a channel records one row here, including the ones
 * that never found a recipient. The list is persisted so a restart keeps the
 * history the settings page shows; writes are serialized so two deliveries in
 * the same tick cannot interleave.
 */
export declare class DeliveryLog {
    #private;
    /** @param options - persistence path, size cap and clock. */
    constructor(options: DeliveryLogOptions);
    /** Load persisted history; a missing or broken file starts empty. */
    load(): Promise<void>;
    /** The recorded attempts, newest first. */
    list(): readonly DeliveryRecord[];
    /**
     * Record one send's per-target outcomes, then trim and persist.
     * @param rows - one row per attempted target.
     */
    record(rows: readonly DeliveredResult[]): void;
    /**
     * Record what the page did with one queued event.
     * The page owns the notification, so the host only learns the outcome from it;
     * recording it keeps "did it go out" answerable for in-app delivery too.
     * @param shown - whether the page actually raised a system notification.
     * @param type - the event kind, for the message column.
     */
    recordRenderer(shown: boolean, type?: string): void;
    /** Resolve once every pending write has settled. */
    flush(): Promise<void>;
}
