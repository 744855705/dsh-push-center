/** WeCom group bot: a webhook that only pushes. */
import { PushChannel } from '../../core/channel.js';
import type { ChannelRuntime } from '../../core/channel.js';
import type { ChannelStatus, ChannelSettings, DeliveryResult, OutboundMessage, RenderedMessage, TargetId } from '../../core/types.js';
import type { WecomWebhookConfig } from '../../config.js';
/** Group bot pushed through its webhook URL. */
export declare class WecomWebhookChannel extends PushChannel {
    #private;
    readonly id = "wecom-webhook";
    readonly capabilities: {
        inbound: boolean;
        actions: "text";
        maxBodyChars: number;
        auth: "none";
        targets: "webhook";
    };
    /** @param config - channel configuration. */
    constructor(config: WecomWebhookConfig);
    get settings(): ChannelSettings;
    get configured(): boolean;
    get status(): ChannelStatus;
    open(runtime: ChannelRuntime): Promise<void>;
    close(): Promise<void>;
    protected render(message: OutboundMessage): RenderedMessage;
    protected transmit(_target: TargetId | null, message: RenderedMessage): Promise<DeliveryResult>;
}
