import type { Logger } from './core/ports.js';
import type { ChannelRegistry } from './core/registry.js';
import type { Router } from './core/router.js';
/** Everything the tool reads at call time. */
export interface PushToolDeps {
    readonly registry: ChannelRegistry;
    readonly router: Router;
    readonly logger: Logger;
    readonly replyTimeoutMs: () => number;
}
/**
 * Build the tool definition.
 * @param deps - registry, router and configuration.
 * @returns the registry-ready definition.
 */
export declare function createPushTool(deps: PushToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
