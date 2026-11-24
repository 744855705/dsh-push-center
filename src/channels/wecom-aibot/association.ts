/** One scan-to-associate attempt, driven by polling. */
import type { Clock, HttpClient, Logger } from '../../core/ports.js'
import { errorMessage } from '../../core/errors.js'
import { createQrClient, type QrClient } from './qr.js'

/** Phase surfaced to the settings page. */
export type AssociationPhase = 'idle' | 'pending' | 'error'

/** Why an attempt failed, translated by the page. */
export type AssociationErrorKey = 'expired' | 'timeout' | 'transport'

/** Observable attempt state. */
export interface AssociationStatus {
  readonly phase: AssociationPhase
  readonly url?: string
  readonly errorKey?: AssociationErrorKey
  readonly error?: string
  /** Set when an attempt completed successfully, so the page can react. */
  readonly completedAt?: number
}

/** Wiring for one attempt. */
export interface AssociationDeps {
  readonly http: HttpClient
  readonly clock: Clock
  readonly logger: Logger
  /** Product label recorded by the vendor. */
  readonly source?: string
  /** Poll interval; defaults to 3s. */
  readonly intervalMs?: number
  /** Attempt lifetime; defaults to 5 minutes. */
  readonly timeoutMs?: number
  /** Called once with the issued credentials. */
  readonly onAssociated: (credentials: { botId: string; secret: string }) => void | Promise<void>
  /** Test seam. */
  readonly client?: QrClient
}

/** Drives one QR association attempt. */
export class AssociationFlow {
  readonly #deps: AssociationDeps
  readonly #client: QrClient
  #status: AssociationStatus = { phase: 'idle' }
  #abort: AbortController | undefined

  /** @param deps - transport, clock and the association callback. */
  constructor(deps: AssociationDeps) {
    this.#deps = deps
    this.#client = deps.client ?? createQrClient(deps.http, deps.source ?? 'dsh-push-center')
  }

  /** Current attempt state. */
  get status(): AssociationStatus {
    return this.#status
  }

  /**
   * Start an attempt: fetch a QR ticket, then poll in the background.
   * @returns the pending state carrying the QR URL.
   */
  async begin(): Promise<AssociationStatus> {
    this.cancel()
    const abort = new AbortController()
    this.#abort = abort
    try {
      const ticket = await this.#client.start(abort.signal)
      this.#status = { phase: 'pending', url: ticket.authUrl }
      void this.#poll(ticket.scode, abort)
      return this.#status
    } catch (error) {
      this.#status = { phase: 'error', errorKey: 'transport', error: errorMessage(error) }
      throw error
    }
  }

  /** Stop polling and forget the attempt. */
  cancel(): void {
    this.#abort?.abort()
    this.#abort = undefined
  }

  async #poll(scode: string, abort: AbortController): Promise<void> {
    const interval = this.#deps.intervalMs ?? 3_000
    const deadline = this.#deps.clock.now() + (this.#deps.timeoutMs ?? 5 * 60_000)
    while (!abort.signal.aborted && this.#deps.clock.now() < deadline) {
      try {
        await this.#deps.clock.sleep(interval, abort.signal)
      } catch {
        return
      }
      const result = await this.#client.poll(scode, abort.signal).catch(() => ({ status: 'pending' as const }))
      if (abort.signal.aborted) return
      if (result.status === 'success') {
        this.cancel()
        this.#status = { phase: 'idle', completedAt: this.#deps.clock.now() }
        try {
          await this.#deps.onAssociated({ botId: result.botId, secret: result.secret })
        } catch (error) {
          this.#deps.logger.error('[push] failed to save associated bot credentials: %s', errorMessage(error))
          this.#status = { phase: 'error', errorKey: 'transport', error: errorMessage(error) }
        }
        return
      }
      if (result.status === 'expired') {
        this.cancel()
        this.#status = { phase: 'error', errorKey: 'expired' }
        return
      }
    }
    if (!abort.signal.aborted) {
      this.#status = { phase: 'error', errorKey: 'timeout' }
      this.cancel()
    }
  }
}
