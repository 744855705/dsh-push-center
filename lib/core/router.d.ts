/** Inbound routing: approvals, questions, waits, continuation and commands. */
import type { ChatText } from './chat-text.js';
import type { Clock, HostBridge, Logger } from './ports.js';
import type { ChannelRegistry } from './registry.js';
import type { Bindings } from './bindings.js';
import type { WaiterReply, Waiters } from './waiter.js';
import type { ApprovalOutcome, ApprovalView, ChannelId, InboundMessage, QuestionAnswer, QuestionAnswerItem, QuestionItem, QuestionView, TargetId } from './types.js';
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
    /**
     * Whether automatic messages may be sent at all.
     *
     * The switch covers everything automatic — event notifications and the
     * approval/question prompts — while `push_message` stays available regardless.
     */
    readonly autoEnabled?: () => boolean;
}
/** Reply vocabulary for approvals (case-insensitive). */
export declare const APPROVE_WORDS: ReadonlySet<string>;
/** Reply vocabulary for rejections (case-insensitive). */
export declare const REJECT_WORDS: ReadonlySet<string>;
/**
 * Routes one inbound chat message to the right action.
 *
 * The vocabulary is channel-independent: buttons on capable channels arrive as
 * the same text (Y/N, an option number, a /command), so this class never asks
 * which bot a message came from.
 */
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
    /**
     * Offer one approval to the chat and wait for the decision.
     * @param view - the host's approval request.
     * @returns the chat decision, or null when another surface answered.
     */
    onApproval(view: ApprovalView): Promise<ApprovalOutcome | null>;
    /**
     * Offer one question batch to the chat and wait for the answer.
     * @param view - the host's question request.
     * @returns the chat answer, or null when another surface answered.
     */
    onQuestion(view: QuestionView): Promise<QuestionAnswer | null>;
    /**
     * Another surface answered first: release the prompt so a late chat reply reports it.
     * @param kind - which prompt kind lost.
     * @param sessionId - the session it belonged to.
     * @param callId - the winning call id, when known.
     */
    drop(kind: 'approval' | 'question', sessionId: string, callId?: string): void;
    /**
     * Hold a send open until a reply arrives on one channel.
     * @param channel - the channel that will answer.
     * @param targets - conversations whose reply counts.
     * @param timeoutMs - longest wait.
     * @param signal - caller cancellation.
     * @returns the reply, or null on timeout/abort.
     */
    awaitReply(channel: ChannelId, targets: readonly TargetId[], timeoutMs: number, signal?: AbortSignal): Promise<WaiterReply | null>;
    /**
     * Route one inbound message.
     * @param inbound - the normalized message.
     */
    route(inbound: InboundMessage): Promise<void>;
    /** Release every pending prompt and wait. */
    dispose(): void;
}
/**
 * Parse one reply into per-question answers.
 *
 * Multiple questions split on newlines or Chinese/Latin separators and map by
 * position; an optioned question accepts numbers (multi-select: several) or an
 * exact label; anything else becomes the custom answer.
 *
 * @param questions - the questions asked.
 * @param reply - the raw reply text.
 * @returns the answers, or null when nothing could be mapped.
 */
export declare function parseAnswers(questions: readonly QuestionItem[], reply: string): QuestionAnswerItem[] | null;
