import { chatText } from '../core/chat-text.js';
import { WechatChannel } from '../channels/wechat/index.js';
import { WecomAibotChannel } from '../channels/wecom-aibot/index.js';
import { WecomWebhookChannel } from '../channels/wecom-webhook/index.js';
import { SystemChannel } from '../channels/system/index.js';
/**
 * Create the channels in stable order.
 *
 * Chat channels exist only while enabled; the system notifier always exists so
 * the settings page can report its platform state, but it is never
 * auto-selectable and only the event switches route to it.
 * @param config - effective configuration.
 * @returns the channels for this configuration.
 */
export function createChannels(config) {
    const welcome = chatText(config.messages.locale).welcome;
    const channels = [];
    if (config.channels.wechat.enabled)
        channels.push(new WechatChannel(config.channels.wechat));
    if (config.channels['wecom-aibot'].enabled)
        channels.push(new WecomAibotChannel(config.channels['wecom-aibot'], { welcomeText: welcome }));
    if (config.channels['wecom-webhook'].enabled)
        channels.push(new WecomWebhookChannel(config.channels['wecom-webhook']));
    channels.push(new SystemChannel(config.system));
    return channels;
}
/**
 * Start every channel, keeping one failure from taking the plugin down.
 * @param channels - the channels to start.
 * @param runtime - the shared channel runtime.
 * @param logger - where start failures are reported.
 */
export async function startChannels(channels, runtime, logger) {
    for (const channel of channels) {
        try {
            await channel.start(runtime);
        }
        catch (error) {
            logger.error('[push] channel %s failed to start: %s', channel.id, error instanceof Error ? error.message : String(error));
        }
    }
}
/**
 * Stop every channel.
 * @param channels - the channels to close.
 */
export async function stopChannels(channels) {
    for (const channel of channels)
        await channel.close();
}
//# sourceMappingURL=channels.js.map