/** Approvals and questions offered to chat, and the replies that settle them. */
import type { ChatText } from './chat-text.js';
import type { ChatState } from './chat-state.js';
import type { ChannelRegistry } from './registry.js';
import type { Clock } from './ports.js';
import type { WaiterReply, Waiters } from './waiter.js';
import type { ApprovalOutcome, ApprovalView, ChannelId, InboundMessage, QuestionAnswer, QuestionAnswerItem, QuestionItem, QuestionView, TargetId } from './types.js';
/** Reply vocabulary for approvals (case-insensitive). */
export declare const APPROVE_WORDS: ReadonlySet<string>;
/** Reply vocabulary for rejections (case-insensitive). */
export declare const REJECT_WORDS: ReadonlySet<string>;
/** What the broker needs to raise prompts. */
export interface PromptDeps {
    readonly registry: ChannelRegistry;
    readonly waiters: Waiters;
    readonly clock: Clock;
    readonly text: () => ChatText;
    readonly state: ChatState;
}
/**
 * Owns the prompts offered to chat.
 *
 * One prompt is outstanding at a time per session: it is queued, pushed to the
 * automatic recipient, and settled by the first reply that maps to it — or by the
 * DSH window, in which case the prompt is dropped and a late reply reports that.
 */
export declare class PromptBroker {
    #private;
    /** @param deps - registry, waiters, clock, wording and session labels. */
    constructor(deps: PromptDeps);
    /** Number of answerable prompts (diagnostics). */
    get pendingCount(): number;
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
     * Settle the outstanding prompt with one reply.
     * @param inbound - the normalized message.
     * @param reply - the trimmed reply text.
     * @returns true when a prompt consumed the reply.
     */
    answer(inbound: InboundMessage, reply: string): Promise<boolean>;
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
