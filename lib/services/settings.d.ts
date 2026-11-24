/**
 * Settings-page operations.
 *
 * Lives outside the composition root so the plugin entry only wires things:
 * every rule the page depends on (what a test push contains, what binding
 * implies, which platform can raise a notification) is decided here.
 */
import type { DeliveryLog } from '../core/delivery-log.js';
import type { Config as PluginConfig } from '../config.js';
import type { ChannelRegistry } from '../core/registry.js';
import type { RendererQueue } from '../core/renderer-queue.js';
import type { RpcHandlers } from '../rpc.js';
/** What the settings operations need from the plugin. */
export interface SettingsDeps {
    readonly registry: ChannelRegistry;
    readonly deliveries: DeliveryLog;
    readonly queue: RendererQueue;
    /** The effective configuration, read at call time. */
    readonly config: () => PluginConfig;
    /** Persist a settings patch; merging and first-entry enabling already happened. */
    readonly saveConfig: (patch: unknown) => Promise<PluginConfig>;
    /** Turn one chat channel on without touching the others. */
    readonly enableChannel: (id: 'wechat' | 'wecom-aibot') => Promise<PluginConfig>;
    readonly revision: () => number;
    readonly tool: () => {
        readonly registered: boolean;
        readonly error?: string;
    };
    readonly associationStatus: () => unknown;
    readonly beginAssociation: () => Promise<unknown>;
}
/**
 * Create the settings handlers.
 * @param deps - the plugin surfaces these operations drive.
 * @returns the RPC handler set.
 */
export declare function createSettingsHandlers(deps: SettingsDeps): RpcHandlers;
