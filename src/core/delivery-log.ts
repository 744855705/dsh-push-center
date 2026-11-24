/** Recent outbound attempts, so "did it actually leave?" has an answer. */
import { JsonDocument } from './store.js'
import type { DeliveredResult } from './types.js'

/** One recorded outbound attempt. */
export interface DeliveryRecord {
  /** Epoch milliseconds of the attempt. */
  readonly at: number
  readonly channel: string
  /** '' for a webhook-style channel that has no addressable conversation. */
  readonly target: string
  readonly ok: boolean
  readonly code?: string
  readonly message?: string
}

/** Wiring for {@link DeliveryLog}. */
export interface DeliveryLogOptions {
  /** Absolute path of the persisted file. */
  readonly path: string
  /** How many attempts to keep; newest first. Defaults to 50. */
  readonly limit?: number
  /** Clock override for tests. */
  readonly now?: () => number
}

/**
 * A bounded, newest-first ledger of outbound attempts.
 *
 * Every send that reaches a channel records one row here, including the ones
 * that never found a recipient. The list is persisted so a restart keeps the
 * history the settings page shows; writes are serialized so two deliveries in
 * the same tick cannot interleave.
 */
export class DeliveryLog {
  readonly #store: JsonDocument<DeliveryRecord[]>
  readonly #limit: number
  readonly #now: () => number
  #records: DeliveryRecord[] = []
  #writing: Promise<void> = Promise.resolve()

  /** @param options - persistence path, size cap and clock. */
  constructor(options: DeliveryLogOptions) {
    this.#store = new JsonDocument<DeliveryRecord[]>(options.path, () => [])
    this.#limit = options.limit ?? 50
    this.#now = options.now ?? (() => Date.now())
  }

  /** Load persisted history; a missing or broken file starts empty. */
  async load(): Promise<void> {
    const stored = await this.#store.read()
    this.#records = Array.isArray(stored) ? stored.slice(0, this.#limit) : []
  }

  /** The recorded attempts, newest first. */
  list(): readonly DeliveryRecord[] {
    return this.#records
  }

  /**
   * Record one send's per-target outcomes, then trim and persist.
   * @param rows - one row per attempted target.
   */
  record(rows: readonly DeliveredResult[]): void {
    if (rows.length === 0) return
    const at = this.#now()
    for (const row of rows) {
      this.#records.unshift({
        at,
        channel: row.channel,
        target: row.target ?? '',
        ok: row.ok,
        ...(row.code === undefined ? {} : { code: row.code }),
        ...(row.message === undefined ? {} : { message: row.message }),
      })
    }
    this.#records = this.#records.slice(0, this.#limit)
    const snapshot = [...this.#records]
    this.#writing = this.#writing.then(() => this.#store.write(snapshot)).catch(() => {})
  }

  /** Resolve once every pending write has settled. */
  async flush(): Promise<void> {
    await this.#writing
  }
}
