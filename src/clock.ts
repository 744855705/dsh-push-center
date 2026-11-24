/** The one clock implementation the plugin wires into its ports. */
import type { Clock } from './core/ports.js'

/**
 * Create the host clock.
 *
 * `sleep` honours an abort signal so a cancelled wait does not keep a timer
 * alive; callers that do not pass one (notifier pacing) simply sleep.
 * @returns the clock port.
 */
export function createClock(): Clock {
  return {
    now: () => Date.now(),
    sleep: (ms: number, signal?: AbortSignal): Promise<void> => new Promise<void>((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(new Error('aborted'))
        return
      }
      const timer = setTimeout(resolve, ms)
      signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('aborted'))
      }, { once: true })
    }),
  }
}
