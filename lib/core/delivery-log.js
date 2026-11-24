/** Recent outbound attempts, so "did it actually leave?" has an answer. */
import { JsonDocument } from './store.js';
/**
 * A bounded, newest-first ledger of outbound attempts.
 *
 * Every send that reaches a channel records one row here, including the ones
 * that never found a recipient. The list is persisted so a restart keeps the
 * history the settings page shows; writes are serialized so two deliveries in
 * the same tick cannot interleave.
 */
export class DeliveryLog {
    #store;
    #limit;
    #now;
    #records = [];
    #writing = Promise.resolve();
    /** @param options - persistence path, size cap and clock. */
    constructor(options) {
        this.#store = new JsonDocument(options.path, () => []);
        this.#limit = options.limit ?? 50;
        this.#now = options.now ?? (() => Date.now());
    }
    /** Load persisted history; a missing or broken file starts empty. */
    async load() {
        const stored = await this.#store.read();
        this.#records = Array.isArray(stored) ? stored.slice(0, this.#limit) : [];
    }
    /** The recorded attempts, newest first. */
    list() {
        return this.#records;
    }
    /**
     * Record one send's per-target outcomes, then trim and persist.
     * @param rows - one row per attempted target.
     */
    record(rows) {
        if (rows.length === 0)
            return;
        const at = this.#now();
        for (const row of rows) {
            this.#records.unshift({
                at,
                channel: row.channel,
                target: row.target ?? '',
                ok: row.ok,
                ...(row.code === undefined ? {} : { code: row.code }),
                ...(row.message === undefined ? {} : { message: row.message }),
            });
        }
        this.#records = this.#records.slice(0, this.#limit);
        const snapshot = [...this.#records];
        this.#writing = this.#writing.then(() => this.#store.write(snapshot)).catch(() => { });
    }
    /**
     * Record what the page did with one queued event.
     * The page owns the notification, so the host only learns the outcome from it;
     * recording it keeps "did it go out" answerable for in-app delivery too.
     * @param shown - whether the page actually raised a system notification.
     * @param type - the event kind, for the message column.
     */
    recordRenderer(shown, type) {
        this.record([{
                channel: 'system',
                target: '',
                ok: shown,
                ...(shown ? {} : { code: 'permission-denied', message: 'the page could not show this notification' }),
                ...(type === undefined ? {} : { message: 'in-app: ' + type }),
            }]);
    }
    /** Resolve once every pending write has settled. */
    async flush() {
        await this.#writing;
    }
}
//# sourceMappingURL=delivery-log.js.map