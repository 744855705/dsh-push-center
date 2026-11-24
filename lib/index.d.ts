import { Config as ConfigSchema, defaultConfig, type Config as PluginConfig } from './config.js';
export declare const name = "push-center";
/** No hard host dependency: everything is soft-resolved so headless boots work. */
export declare const inject: string[];
export declare const Config: import("@deepseek-ai/schemastery").default<ConfigSchema>;
export { defaultConfig };
export type { PluginConfig };
/** Merge the patch config with the persisted settings page state. */
/**
 * Merge defaults, the profile patch and the settings-page state.
 *
 * Every group is merged on its own: a patch that omits a channel field must not
 * drop that field's default (a missing wsUrl used to crash the channel at start).
 * @param patch - configuration from the profile patch layer.
 * @param stored - configuration saved by the settings page.
 * @returns the effective configuration.
 */
export declare function mergeConfig(patch: PluginConfig, stored: Partial<PluginConfig> | undefined): PluginConfig;
/**
 * Mount the plugin.
 * @param rawCtx - the plugin's cordis context.
 * @param patch - configuration from the profile patch layer.
 */
export declare function apply(rawCtx: unknown, patch: PluginConfig): Promise<void>;
export default apply;
