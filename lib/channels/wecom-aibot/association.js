import { errorMessage } from '../../core/errors.js';
import { createQrClient } from './qr.js';
/** Drives one QR association attempt. */
export class AssociationFlow {
    #deps;
    #client;
    #status = { phase: 'idle' };
    #abort;
    /** @param deps - transport, clock and the association callback. */
    constructor(deps) {
        this.#deps = deps;
        this.#client = deps.client ?? createQrClient(deps.http, deps.source ?? 'dsh-push-center');
    }
    /** Current attempt state. */
    get status() {
        return this.#status;
    }
    /**
     * Start an attempt: fetch a QR ticket, then poll in the background.
     * @returns the pending state carrying the QR URL.
     */
    async begin() {
        this.cancel();
        const abort = new AbortController();
        this.#abort = abort;
        try {
            const ticket = await this.#client.start(abort.signal);
            this.#status = { phase: 'pending', url: ticket.authUrl };
            void this.#poll(ticket.scode, abort);
            return this.#status;
        }
        catch (error) {
            this.#status = { phase: 'error', errorKey: 'transport', error: errorMessage(error) };
            throw error;
        }
    }
    /** Stop polling and forget the attempt. */
    cancel() {
        this.#abort?.abort();
        this.#abort = undefined;
    }
    async #poll(scode, abort) {
        const interval = this.#deps.intervalMs ?? 3_000;
        const deadline = this.#deps.clock.now() + (this.#deps.timeoutMs ?? 5 * 60_000);
        while (!abort.signal.aborted && this.#deps.clock.now() < deadline) {
            try {
                await this.#deps.clock.sleep(interval, abort.signal);
            }
            catch {
                return;
            }
            const result = await this.#client.poll(scode, abort.signal).catch(() => ({ status: 'pending' }));
            if (abort.signal.aborted)
                return;
            if (result.status === 'success') {
                this.cancel();
                this.#status = { phase: 'idle', completedAt: this.#deps.clock.now() };
                try {
                    await this.#deps.onAssociated({ botId: result.botId, secret: result.secret });
                }
                catch (error) {
                    this.#deps.logger.error('[push] failed to save associated bot credentials: %s', errorMessage(error));
                    this.#status = { phase: 'error', errorKey: 'transport', error: errorMessage(error) };
                }
                return;
            }
            if (result.status === 'expired') {
                this.cancel();
                this.#status = { phase: 'error', errorKey: 'expired' };
                return;
            }
        }
        if (!abort.signal.aborted) {
            this.#status = { phase: 'error', errorKey: 'timeout' };
            this.cancel();
        }
    }
}
//# sourceMappingURL=association.js.map