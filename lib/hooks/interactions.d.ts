/** answerer waterfalls: offer approvals/questions to chat, race the browser. */
import type { Logger } from '../core/ports.js';
import type { Router } from '../core/router.js';
import type { ApprovalOutcome, QuestionAnswer } from '../core/types.js';
/** The cordis surface this bridge uses. */
export interface InteractionContextLike {
    on(name: string, listener: (...args: never[]) => unknown, options?: {
        prepend?: boolean;
    }): () => void;
    readonly logger: Logger;
}
/** Bridges DSH answerer waterfalls to the router. */
export declare class DshInteractions {
    #private;
    /**
     * @param ctx - host context with the event bus.
     * @param router - the inbound router that owns the chat side.
     */
    constructor(ctx: InteractionContextLike, router: Router);
    /** Register both answerer listeners; returns the disposer. */
    attach(): () => void;
}
/** Re-export for callers that only need the outcome type. */
export type { ApprovalOutcome, QuestionAnswer };
