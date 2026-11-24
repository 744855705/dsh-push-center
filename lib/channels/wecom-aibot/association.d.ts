/** One scan-to-associate attempt, driven by polling. */
import type { Clock, HttpClient, Logger } from '../../core/ports.js';
import { type QrClient } from './qr.js';
/** Phase surfaced to the settings page. */
export type AssociationPhase = 'idle' | 'pending' | 'error';
/** Why an attempt failed, translated by the page. */
export type AssociationErrorKey = 'expired' | 'timeout' | 'transport';
/** Observable attempt state. */
export interface AssociationStatus {
    readonly phase: AssociationPhase;
    readonly url?: string;
    readonly errorKey?: AssociationErrorKey;
    readonly error?: string;
    /** Set when an attempt completed successfully, so the page can react. */
    readonly completedAt?: number;
}
/** Wiring for one attempt. */
export interface AssociationDeps {
    readonly http: HttpClient;
    readonly clock: Clock;
    readonly logger: Logger;
    /** Product label recorded by the vendor. */
    readonly source?: string;
    /** Poll interval; defaults to 3s. */
    readonly intervalMs?: number;
    /** Attempt lifetime; defaults to 5 minutes. */
    readonly timeoutMs?: number;
    /** Called once with the issued credentials. */
    readonly onAssociated: (credentials: {
        botId: string;
        secret: string;
    }) => void | Promise<void>;
    /** Test seam. */
    readonly client?: QrClient;
}
/** Drives one QR association attempt. */
export declare class AssociationFlow {
    #private;
    /** @param deps - transport, clock and the association callback. */
    constructor(deps: AssociationDeps);
    /** Current attempt state. */
    get status(): AssociationStatus;
    /**
     * Start an attempt: fetch a QR ticket, then poll in the background.
     * @returns the pending state carrying the QR URL.
     */
    begin(): Promise<AssociationStatus>;
    /** Stop polling and forget the attempt. */
    cancel(): void;
}
