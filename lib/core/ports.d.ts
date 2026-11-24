/** Ports the domain depends on; implementations are injected by the composition root. */
/** Narrow HTTP response the domain understands. */
export interface HttpResponse {
    readonly ok: boolean;
    readonly status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
}
/** Narrow HTTP request the domain issues. */
export interface HttpRequest {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
}
/** HTTP port; tests inject a fake, production injects fetch. */
export interface HttpClient {
    send(url: string, request?: HttpRequest): Promise<HttpResponse>;
}
/** Time port so channel logic stays deterministic under test. */
export interface Clock {
    now(): number;
    sleep(ms: number, signal?: AbortSignal): Promise<void>;
}
/** Logging port matching the cordis logger surface. */
export interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}
/** Session operations the router needs; hooks/host-sessions.ts implements it. */
export interface SessionSummary {
    readonly sessionId: string;
    readonly updatedAt: number;
    readonly running: boolean;
    readonly blank: boolean;
    readonly cwd?: string;
    readonly title?: string;
    readonly subagent?: boolean;
}
/** One workspace row for the /workspace menu. */
export interface WorkspaceSummary {
    readonly workspaceId: string;
    readonly path: string;
    readonly title: string;
}
/** Result of appending a user message to a session. */
export interface PromptResult {
    readonly ok: boolean;
    readonly error?: string;
}
/** Result of creating a session inside a workspace. */
export interface CreateSessionResult {
    readonly ok: boolean;
    readonly sessionId?: string;
    readonly error?: string;
}
/** Host session operations; a deployment without them degrades with a clear chat message. */
export interface HostBridge {
    prompt(sessionId: string, text: string): Promise<PromptResult>;
    listSessions(): Promise<readonly SessionSummary[] | null>;
    listWorkspaces(): Promise<readonly WorkspaceSummary[] | null>;
    createSession(workspaceId: string): Promise<CreateSessionResult>;
}
