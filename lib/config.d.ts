/** Plugin configuration: the schema cordis validates and the settings page edits. */
import z from '@deepseek-ai/schemastery';
/** Event switches. */
export interface EventSwitches {
    readonly conversationCompleted: boolean;
    readonly conversationPaused: boolean;
    readonly conversationFailed: boolean;
    readonly authorizationRequired: boolean;
    readonly confirmationRequired: boolean;
    readonly todoProgress: boolean;
}
/** Settings every chat channel shares. */
export interface ChatChannelConfig {
    readonly enabled: boolean;
    readonly defaultTargets: readonly string[];
    readonly interactive: boolean;
}
/** WeChat ClawBot settings. */
export interface WechatConfig extends ChatChannelConfig {
    /** Session file holding the bot token and captured context tokens. */
    readonly sessionFile: string;
}
/** WeCom AI bot settings. */
export interface WecomAibotConfig extends ChatChannelConfig {
    readonly botId: string;
    readonly secret: string;
    /** Private-deployment WebSocket endpoint; empty uses the official one. */
    readonly wsUrl: string;
}
/** WeCom group bot settings (push only). */
export interface WecomWebhookConfig {
    readonly enabled: boolean;
    readonly webhookUrl: string;
    readonly mentions: readonly string[];
    readonly msgType: 'text' | 'markdown';
}
/** Which notification path a push prefers. */
export type SystemBackend = 'auto' | 'renderer' | 'host';
/** In-app (renderer) notifications: same events, its own switches. */
export interface SystemConfig {
    readonly enabled: boolean;
    /** Which events also raise a system notification; independent of the chat events. */
    readonly events: EventSwitches;
    /**
     * auto: the page when one is open, otherwise the OS command where it works.
     * renderer: the page only (macOS has no usable host identity).
     * host: the OS command only.
     */
    readonly backend: SystemBackend;
    /** Play a short cue with the notification; the page synthesizes it, the host does not. */
    readonly sound: boolean;
}
/** Complete plugin configuration. */
export interface Config {
    readonly enabled: boolean;
    readonly titlePrefix: string;
    readonly mainAgentOnly: boolean;
    readonly events: EventSwitches;
    /** Channels event notifications go to; empty means the default channel. */
    readonly notify: {
        readonly channels: readonly string[];
    };
    readonly push: {
        readonly defaultChannel: string;
        readonly replyTimeoutMs: number;
    };
    readonly messages: {
        readonly locale: 'zh' | 'en';
        readonly hint: boolean;
    };
    readonly system: SystemConfig;
    readonly channels: {
        readonly wechat: WechatConfig;
        readonly 'wecom-aibot': WecomAibotConfig;
        readonly 'wecom-webhook': WecomWebhookConfig;
    };
}
/** Cordis-validated schema. */
export declare const Config: z<Config>;
/** Default configuration used when a channel or the settings page needs a base. */
export declare function defaultConfig(): Config;
/**
 * Turn a channel on the first time it receives what it needs to work.
 *
 * A blank settings page must not require "enable + save + scan": binding is the
 * act of enabling. Once a channel already had credentials, an explicit off stays
 * off and is never overridden by a later edit.
 * @param previous - configuration before this save.
 * @param next - configuration being saved.
 * @returns next, with newly-filled channels enabled.
 */
export declare function autoEnableOnFirstEntry(previous: Config, next: Config): Config;
