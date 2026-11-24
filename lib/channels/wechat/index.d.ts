/** WeChat ClawBot (iLink): QR login, long-poll inbox, reply-based pushes. */
import { PushChannel } from '../../core/channel.js';
import type { ChannelRuntime } from '../../core/channel.js';
import type { WechatConfig } from '../../config.js';
import type { ChannelSettings, ChannelStatus, DeliveryResult, OutboundMessage, RenderedMessage, TargetId } from '../../core/types.js';
import { type ILinkWire } from './ilink.js';
/** Personal WeChat bot through Tencent iLink. */
export declare class WechatChannel extends PushChannel {
    #private;
    readonly id = "wechat";
    readonly capabilities: {
        inbound: boolean;
        actions: "text";
        maxBodyChars: number;
        auth: "qr";
        targets: "chat";
    };
    /**
     * @param config - channel configuration.
     * @param wire - optional transport override for tests.
     */
    constructor(config: WechatConfig, wire?: ILinkWire);
    get settings(): ChannelSettings;
    get configured(): boolean;
    get status(): ChannelStatus;
    /** Current QR payload, when a login is pending. */
    get qr(): {
        url: string;
    } | undefined;
    /** Forget the stored token and start a fresh QR login. */
    relogin(): Promise<void>;
    open(runtime: ChannelRuntime): Promise<void>;
    openUnsafe(runtime: ChannelRuntime): Promise<void>;
    close(): Promise<void>;
    protected render(message: OutboundMessage): RenderedMessage;
    protected transmit(target: TargetId | null, message: RenderedMessage): Promise<DeliveryResult>;
}
