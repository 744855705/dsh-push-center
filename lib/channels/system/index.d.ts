import { PushChannel } from '../../core/channel.js';
import type { ChannelRuntime } from '../../core/channel.js';
import type { ChannelSettings, ChannelStatus, DeliveryResult, OutboundMessage, RenderedMessage, TargetId } from '../../core/types.js';
import type { SystemConfig } from '../../config.js';
/** One shell invocation that raises an OS notification. */
export interface NotificationCommand {
    readonly command: string;
    readonly args: readonly string[];
}
/**
 * The command that raises one OS notification, or undefined where this plugin
 * has no notifier. Pure: the tests assert every platform's argument shape.
 * @param platform - `process.platform` of the host.
 * @param title - notification title.
 * @param body - notification body; newlines collapse to spaces.
 * @returns the command and its exact arguments.
 */
export declare function notificationCommand(platform: NodeJS.Platform, title: string, body: string): NotificationCommand | undefined;
/**
 * The OS notification channel.
 *
 * It is deliberately not auto-selectable and not addressable: only the event
 * switches in `config.system.events` ever reach it, so an automatic push can
 * never leak into the desktop.
 */
export declare class SystemChannel extends PushChannel {
    #private;
    readonly id = "system";
    readonly autoSelectable = false;
    readonly capabilities: {
        inbound: boolean;
        actions: "text";
        maxBodyChars: number;
        auth: "none";
        targets: "webhook";
    };
    /**
     * @param config - system notification settings.
     * @param platform - host platform, overridable in tests.
     */
    constructor(config: SystemConfig, platform?: NodeJS.Platform);
    get settings(): ChannelSettings;
    /** Whether this platform has a notifier at all. */
    get configured(): boolean;
    get status(): ChannelStatus;
    open(runtime: ChannelRuntime): Promise<void>;
    close(): Promise<void>;
    protected render(message: OutboundMessage): RenderedMessage;
    protected transmit(_target: TargetId | null, message: RenderedMessage): Promise<DeliveryResult>;
}
