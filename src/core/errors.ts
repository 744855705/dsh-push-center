/** Stable failure codes surfaced by deliveries, the tool result and the settings page. */
export type PushErrorCode =
  | 'unconfigured'
  | 'auth-failed'
  | 'transport'
  | 'rate-limited'
  | 'target-unknown'
  | 'timeout'
  | 'aborted'
  | 'unsupported'
  | 'notifier-missing'

/** An expected push failure. Never crosses the DSH boundary; deliveries return it as a code. */
export class PushError extends Error {
  readonly code: PushErrorCode

  /**
   * @param code - stable machine-routable code.
   * @param message - human-readable detail.
   */
  constructor(code: PushErrorCode, message: string) {
    super(message)
    this.name = 'PushError'
    this.code = code
  }
}

/** Human-readable message from an unknown thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

/** Stable code for an unknown thrown value, defaulting to transport. */
export function errorCode(error: unknown): PushErrorCode {
  return error instanceof PushError ? error.code : 'transport'
}
