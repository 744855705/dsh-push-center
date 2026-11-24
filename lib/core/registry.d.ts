import type { PushChannel } from './channel.js';
import type { ChannelId, DeliveredResult, OutboundMessage, SendReport, TargetId } from './types.js';
/** What routing needs to know from configuration, resolved at call time. */
export interface RoutingPolicy {
    /** Configured default channel id, or '' when the first usable channel wins. */
    defaultChannelId(): string;
    /** Configured automatic-message channel id, or '' to follow the default. */
    autoChannelId?(): string;
}
/** Options for one registry send. */
export interface RegistrySendOptions {
    readonly channel?: ChannelId;
    readonly target?: TargetId;
    readonly signal?: AbortSignal;
}
/**
 * Owns the live channels and decides who receives a message.
 *
 * Selection is fixed and never fans out: an explicit channel wins; otherwise
 * the configured default; when the configured default exists but is unusable
 * the send reports why instead of silently switching to another channel. Only
 * an unconfigured default ('') resolves to the first usable channel.
 */
export declare class ChannelRegistry {
    #private;
    /** @param policy - configuration accessor for the default channel. */
    constructor(policy: RoutingPolicy);
    /** Register one channel, preserving configuration order. */
    add(channel: PushChannel): void;
    /** Replace the live channel set (config change). */
    reset(channels: readonly PushChannel[]): void;
    /** Every channel, in configuration order. */
    all(): readonly PushChannel[];
    /** One channel by id. */
    get(id: ChannelId): PushChannel | undefined;
    /** Channels that can send right now. */
    usable(): PushChannel[];
    /**
     * The channel a send uses when it names none.
     * A configured id is honoured even while unusable, so the send can report the
     * real reason instead of leaking to another channel; only '' falls back to the
     * first usable channel.
     * @returns the chosen channel, or undefined when nothing can take the message.
     */
    defaultChannel(): PushChannel | undefined;
    /**
     * Send one message through exactly one channel.
     * @param message - the domain message.
     * @param options - explicit channel and target.
     * @returns what was delivered and why nothing was.
     */
    send(message: OutboundMessage, options?: RegistrySendOptions): Promise<SendReport>;
    /**
     * Send one automatic message (event notifications).
     * @param message - the domain message.
     * @returns what was delivered and why nothing was.
     */
    sendAutomatic(message: OutboundMessage): Promise<SendReport>;
    /**
     * Send one prompt that expects a reply (approvals, questions).
     * @param message - the domain message.
     * @returns what was delivered and why nothing was.
     */
    sendPrompt(message: OutboundMessage): Promise<SendReport>;
    /**
     * Send a plain text to one exact conversation (receipts, command answers).
     * @param channelId - the channel to answer on.
     * @param target - the conversation.
     * @param text - the text.
     * @returns the delivery result, or a coded failure when the channel is gone.
     */
    pushText(channelId: ChannelId, target: TargetId, text: string): Promise<DeliveredResult>;
}
