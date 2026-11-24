/** An expected push failure. Never crosses the DSH boundary; deliveries return it as a code. */
export class PushError extends Error {
    code;
    /**
     * @param code - stable machine-routable code.
     * @param message - human-readable detail.
     */
    constructor(code, message) {
        super(message);
        this.name = 'PushError';
        this.code = code;
    }
}
/** Human-readable message from an unknown thrown value. */
export function errorMessage(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'string')
        return error;
    return String(error);
}
/** Stable code for an unknown thrown value, defaulting to transport. */
export function errorCode(error) {
    return error instanceof PushError ? error.code : 'transport';
}
//# sourceMappingURL=errors.js.map