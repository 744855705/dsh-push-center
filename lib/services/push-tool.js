import { createPushTool } from '../tool.js';
/**
 * Mount the tool once the tools service appears.
 *
 * Registration failures are invisible from the outside, so the outcome is kept
 * and surfaced on the settings page instead of being discovered by trial.
 * @param ctx - the plugin context (only `inject` is used).
 * @param deps - the collaborators the tool needs.
 * @returns a reader for the registration outcome.
 */
export function mountPushTool(ctx, deps) {
    let state = { registered: false, error: 'tools service is not available' };
    ctx.inject(['tools'], (scoped) => {
        const tools = scoped.tools;
        if (tools === undefined)
            return;
        try {
            tools.register(createPushTool(deps));
            state = { registered: true };
        }
        catch (error) {
            state = { registered: false, error: error instanceof Error ? error.message : String(error) };
            deps.logger.error('[push] push_message registration failed: %s', state.error);
        }
    });
    return () => state;
}
//# sourceMappingURL=push-tool.js.map