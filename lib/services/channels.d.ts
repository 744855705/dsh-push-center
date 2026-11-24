/** Building, starting and stopping the channel set. */
import type { Config as PluginConfig } from '../config.js';
import type { ChannelRuntime, PushChannel } from '../core/channel.js';
import type { Logger } from '../core/ports.js';
/**
 * Create the channels in stable order.
 *
 * Chat channels exist only while enabled; the system notifier always exists so
 * the settings page can report its platform state, but it is never
 * auto-selectable and only the event switches route to it.
 * @param config - effective configuration.
 * @returns the channels for this configuration.
 */
export declare function createChannels(config: PluginConfig): PushChannel[];
/**
 * Start every channel, keeping one failure from taking the plugin down.
 * @param channels - the channels to start.
 * @param runtime - the shared channel runtime.
 * @param logger - where start failures are reported.
 */
export declare function startChannels(channels: readonly PushChannel[], runtime: ChannelRuntime, logger: Logger): Promise<void>;
/**
 * Stop every channel.
 * @param channels - the channels to close.
 */
export declare function stopChannels(channels: readonly PushChannel[]): Promise<void>;
