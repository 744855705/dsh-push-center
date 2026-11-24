/**
 * Create the host clock.
 *
 * `sleep` honours an abort signal so a cancelled wait does not keep a timer
 * alive; callers that do not pass one (notifier pacing) simply sleep.
 * @returns the clock port.
 */
export function createClock() {
    return {
        now: () => Date.now(),
        sleep: (ms, signal) => new Promise((resolve, reject) => {
            if (signal?.aborted === true) {
                reject(new Error('aborted'));
                return;
            }
            const timer = setTimeout(resolve, ms);
            signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('aborted'));
            }, { once: true });
        }),
    };
}
//# sourceMappingURL=clock.js.map