/** Session lifecycle → push events. */
import type { Logger } from '../core/ports.js';
import type { Notifier } from '../core/notifier.js';
import { type SessionLike } from './summary.js';
/** What this hook needs from the host and configuration. */
export interface SessionEventsDeps {
    readonly on: (name: string, listener: (session: SessionLike, event: Record<string, unknown>) => void) => () => void;
    readonly logger: Logger;
    readonly notifier: Notifier;
    readonly mainAgentOnly: () => boolean;
    readonly locale: () => 'zh' | 'en';
}
/** Translate session events into pushes. */
export declare class SessionEvents {
    #private;
    /** @param deps - bus, notifier and configuration accessors. */
    constructor(deps: SessionEventsDeps);
    /** Subscribe; returns the disposer. */
    attach(): () => void;
}
