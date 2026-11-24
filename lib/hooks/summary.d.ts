/** Turn summary: what the human asked and what the agent answered. */
/** Structural session facts this module reads. */
export interface SessionLike {
    readonly id?: string;
    readonly log?: readonly unknown[];
    readonly firstLiveSeq?: number;
    snapshotEvents?(): readonly unknown[];
    readonly header?: {
        readonly cwd?: string;
        readonly origin?: string;
        readonly delegationDepth?: number;
    };
}
/** What one finished turn looked like. */
export interface TurnSummary {
    readonly body: string;
    readonly workspace?: string;
    readonly title?: string;
    readonly userPrompt?: string;
    readonly reply?: string;
    readonly tools?: readonly string[];
    readonly steps?: number;
    readonly durationMs?: number;
    readonly sessionId?: string;
}
/** Workspace label: basename of the session cwd. */
export declare function workspaceOf(session: SessionLike): string | undefined;
/** Whether the session is a delegated subagent. */
export declare function isSubagentSession(session: SessionLike): boolean;
/**
 * Describe the turn that just ended.
 * @param session - the session instance.
 * @param turn - the turn number.
 * @returns the push body plus structured details.
 */
export declare function summarizeTurn(session: SessionLike, turn: number): TurnSummary;
