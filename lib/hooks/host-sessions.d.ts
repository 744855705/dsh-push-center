import type { CreateSessionResult, HostBridge, Logger, PromptResult, SessionSummary, WorkspaceSummary } from '../core/ports.js';
/** The cordis surface this bridge reads. */
export interface HostContextLike {
    get(name: string): unknown;
    readonly logger: Logger;
}
/** Host session operations over the current DSH services. */
export declare class HostSessions implements HostBridge {
    #private;
    /** @param ctx - the plugin's host context. */
    constructor(ctx: HostContextLike);
    /** {@inheritDoc HostBridge.prompt} */
    prompt(sessionId: string, body: string): Promise<PromptResult>;
    /** {@inheritDoc HostBridge.listSessions} */
    listSessions(): Promise<readonly SessionSummary[] | null>;
    /** {@inheritDoc HostBridge.listWorkspaces} */
    listWorkspaces(): Promise<readonly WorkspaceSummary[] | null>;
    /** {@inheritDoc HostBridge.createSession} */
    createSession(workspaceId: string): Promise<CreateSessionResult>;
}
