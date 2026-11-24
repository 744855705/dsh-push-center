/** Stable failure codes surfaced by deliveries, the tool result and the settings page. */
export type PushErrorCode = 'unconfigured' | 'auth-failed' | 'transport' | 'rate-limited' | 'target-unknown' | 'timeout' | 'aborted' | 'unsupported' | 'notifier-missing';
/** An expected push failure. Never crosses the DSH boundary; deliveries return it as a code. */
export declare class PushError extends Error {
    readonly code: PushErrorCode;
    /**
     * @param code - stable machine-routable code.
     * @param message - human-readable detail.
     */
    constructor(code: PushErrorCode, message: string);
}
/** Human-readable message from an unknown thrown value. */
export declare function errorMessage(error: unknown): string;
/** Stable code for an unknown thrown value, defaulting to transport. */
export declare function errorCode(error: unknown): PushErrorCode;
