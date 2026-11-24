/**
 * Inbound routing.
 *
 * A thin facade over three collaborators: the chat's session memory
 * ({@link ChatState}), the prompts it is answering ({@link PromptBroker}) and the
 * commands it accepts ({@link ChatCommands}). Routing itself decides only where a
 * message belongs — everything else lives in the collaborator that owns it.
 */
import type { ChatText } from './chat-text.js';
import type { Clock, HostBridge, Logger } from './ports.js';
import type { ChannelRegistry } from './registry.js';
import type { Bindings } from './bindings.js';
import type { WaiterReply, Waiters } from './waiter.js';
import type { ApprovalOutcome, ApprovalView, ChannelId, InboundMessage, QuestionAnswer, QuestionView, TargetId } from './types.js';
export { APPROVE_WORDS, REJECT_WORDS, parseAnswers } from './prompts.js';
/** Everything the router drives. */
export interface RouterDeps {
    readonly registry: ChannelRegistry;
    readonly bindings: Bindings;
    readonly waiters: Waiters;
    readonly host: HostBridge;
    readonly clock: Clock;
    readonly logger: Logger;
    /** Chat wording for the configured chat language, resolved per call. */
    readonly text: () => ChatText;
    /** Whether notifications append the reply hint. */
    readonly hintEnabled: () => boolean;
}
/** Routes one inbound chat message to the part of the plugin that owns it. */
export declare class Router {
    #private;
    /** @param deps - registry, stores and host session operations. */
    constructor(deps: RouterDeps);
    /** Number of answerable prompts (diagnostics). */
    get pendingCount(): number;
    /** Remember the session a pushed notification belongs to. */
    noteNotification(channel: ChannelId, target: TargetId, sessionId?: string): void;
    /** Label a session by its workspace for receipts. */
    labelSession(sessionId: string, workspace?: string): void;
    /** Offer one approval to the chat; null when another surface answered. */
    onApproval(view: ApprovalView): Promise<ApprovalOutcome | null>;
    /** Offer one question batch to the chat; null when another surface answered. */
    onQuestion(view: QuestionView): Promise<QuestionAnswer | null>;
    /** Another surface answered first: release the prompt. */
    drop(kind: 'approval' | 'question', sessionId: string, callId?: string): void;
    /** Hold a send open until a reply arrives on one channel. */
    awaitReply(channel: ChannelId, targets: readonly TargetId[], timeoutMs: number, signal?: AbortSignal): Promise<WaiterReply | null>;
    /**
     * Route one inbound message.
     * @param inbound - the normalized message.
     */
    route(inbound: InboundMessage): Promise<void>;
    /** Release every pending prompt and wait. */
    dispose(): void;
}
