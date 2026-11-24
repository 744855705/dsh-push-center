/** Registry of open waits, keyed by an opaque id. */
export class Waiters {
    #open = new Map();
    #next = 0;
    /**
     * Open a wait for the next reply on one channel.
     * @param channel - the channel expected to answer.
     * @param targets - conversations whose reply counts.
     * @param timeoutMs - longest wait before 'timeout'.
     * @param signal - caller cancellation.
     * @returns the waiter handle.
     */
    open(channel, targets, timeoutMs, signal) {
        this.#next += 1;
        const id = `wait-${this.#next}`;
        const allowed = new Set(targets);
        let settleFn;
        const promise = new Promise((resolve) => {
            settleFn = (reply, reason) => {
                this.#open.delete(id);
                if (reason !== undefined)
                    resolve(null);
                else
                    resolve(reply);
            };
        });
        const timer = setTimeout(() => {
            settleFn?.(null, 'timeout');
        }, timeoutMs);
        const onAbort = () => {
            settleFn?.(null, 'aborted');
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        const cleanup = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            this.#open.delete(id);
        };
        this.#open.set(id, { channel, targets: allowed, settle: settleFn, cleanup });
        return {
            id,
            channel,
            targets: [...targets],
            promise,
            cancel: (reason) => {
                const entry = this.#open.get(id);
                if (entry === undefined)
                    return;
                entry.cleanup();
                entry.settle(null, reason);
            },
        };
    }
    /**
     * Hand one inbound reply to the newest matching waiter.
     * @param channel - the channel the reply came from.
     * @param target - the conversation it came from.
     * @param text - the reply text.
     * @param at - arrival time.
     * @returns whether a waiter consumed it.
     */
    settle(channel, target, text, at) {
        for (const [id, entry] of [...this.#open.entries()].toReversed()) {
            if (entry.channel !== channel || !entry.targets.has(target))
                continue;
            this.#open.delete(id);
            entry.cleanup();
            entry.settle({ text, target, at });
            return true;
        }
        return false;
    }
    /** Number of open waits (diagnostics). */
    get size() {
        return this.#open.size;
    }
    /** Release every open wait. */
    dispose() {
        for (const entry of this.#open.values()) {
            entry.cleanup();
            entry.settle(null, 'aborted');
        }
        this.#open.clear();
    }
}
//# sourceMappingURL=waiter.js.map