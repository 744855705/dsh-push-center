/** The one clock implementation the plugin wires into its ports. */
import type { Clock } from './core/ports.js';
/**
 * Create the host clock.
 *
 * `sleep` honours an abort signal so a cancelled wait does not keep a timer
 * alive; callers that do not pass one (notifier pacing) simply sleep.
 * @returns the clock port.
 */
export declare function createClock(): Clock;
