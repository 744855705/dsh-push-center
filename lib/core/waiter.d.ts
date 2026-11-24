/** Pending "waiting for a chat reply" tickets used by push_message. */
import type { ChannelId, TargetId } from './types.js';
/** A reply that satisfied a waiter. */
export interface WaiterReply {
    readonly text: string;
    readonly target: TargetId;
    readonly at: number;
}
/** Why a wait ended without a reply. */
export type WaiterFailure = 'timeout' | 'aborted';
/** One open wait. */
export interface Waiter {
    readonly id: string;
    readonly channel: ChannelId;
    readonly targets: readonly TargetId[];
    readonly promise: Promise<WaiterReply | null>;
    cancel(reason: WaiterFailure): void;
}
/** Registry of open waits, keyed by an opaque id. */
export declare class Waiters {
    #private;
    /**
     * Open a wait for the next reply on one channel.
     * @param channel - the channel expected to answer.
     * @param targets - conversations whose reply counts.
     * @param timeoutMs - longest wait before 'timeout'.
     * @param signal - caller cancellation.
     * @returns the waiter handle.
     */
    open(channel: ChannelId, targets: readonly TargetId[], timeoutMs: number, signal?: AbortSignal): Waiter;
    /**
     * Hand one inbound reply to the newest matching waiter.
     * @param channel - the channel the reply came from.
     * @param target - the conversation it came from.
     * @param text - the reply text.
     * @param at - arrival time.
     * @returns whether a waiter consumed it.
     */
    settle(channel: ChannelId, target: TargetId, text: string, at: number): boolean;
    /** Number of open waits (diagnostics). */
    get size(): number;
    /** Release every open wait. */
    dispose(): void;
}
