import { PushChannel } from '../../core/channel.js';
import type { ChannelRuntime } from '../../core/channel.js';
import type { WecomAibotConfig } from '../../config.js';
import type { ChannelSettings, ChannelStatus, DeliveryResult, OutboundMessage, RenderedMessage, TargetId } from '../../core/types.js';
/** 企业微信智能机器人 channel. */
export declare class WecomAibotChannel extends PushChannel {
    #private;
    readonly id = "wecom-aibot";
    readonly capabilities: {
        inbound: boolean;
        actions: "buttons";
        maxBodyChars: number;
        auth: "none";
        targets: "chat";
    };
    /**
     * @param config - channel configuration.
     * @param options - optional welcome text sent when a chat opens.
     */
    constructor(config: WecomAibotConfig, options?: {
        welcomeText?: string;
    });
    get settings(): ChannelSettings;
    get configured(): boolean;
    get status(): ChannelStatus;
    open(runtime: ChannelRuntime): Promise<void>;
    openUnsafe(runtime: ChannelRuntime): Promise<void>;
    close(): Promise<void>;
    protected render(message: OutboundMessage): RenderedMessage;
    protected transmit(target: TargetId | null, message: RenderedMessage): Promise<DeliveryResult>;
}
/**
 * The chat a message or event belongs to: the group chatid, else the sender userid.
 * @param body - the frame body.
 * @returns the target id, or undefined when the body carries none.
 */
export declare function targetFromEvent(body: Record<string, unknown> | undefined): string | undefined;
