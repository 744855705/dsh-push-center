import { Config as ConfigSchema, defaultConfig, mergeConfig, type Config as PluginConfig } from './config.js';
export declare const name = "push-center";
/** No hard host dependency: everything is soft-resolved so headless boots work. */
export declare const inject: string[];
export declare const Config: import("@deepseek-ai/schemastery").default<ConfigSchema>;
export { defaultConfig, mergeConfig };
export type { PluginConfig };
/**
 * Mount the plugin.
 * @param rawCtx - the plugin's cordis context.
 * @param patch - configuration from the profile patch layer.
 */
export declare function apply(rawCtx: unknown, patch: PluginConfig): Promise<void>;
export default apply;
