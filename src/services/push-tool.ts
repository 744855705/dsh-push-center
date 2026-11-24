/** Registering the push_message tool and remembering whether it worked. */
import type { HostLike } from '../host.js'
import type { Logger } from '../core/ports.js'
import type { ChannelRegistry } from '../core/registry.js'
import type { Router } from '../core/router.js'
import { createPushTool } from '../tool.js'

/** Why the tool is or is not available, as the settings page reports it. */
export interface ToolState {
  readonly registered: boolean
  readonly error?: string
}

/** What mounting the tool needs. */
export interface PushToolDeps {
  readonly registry: ChannelRegistry
  readonly router: Router
  readonly logger: Logger
  /** Read at call time: the reply wait follows the saved config. */
  readonly replyTimeoutMs: () => number
}

/**
 * Mount the tool once the tools service appears.
 *
 * Registration failures are invisible from the outside, so the outcome is kept
 * and surfaced on the settings page instead of being discovered by trial.
 * @param ctx - the plugin context (only `inject` is used).
 * @param deps - the collaborators the tool needs.
 * @returns a reader for the registration outcome.
 */
export function mountPushTool(ctx: Pick<HostLike, 'inject'>, deps: PushToolDeps): () => ToolState {
  let state: ToolState = { registered: false, error: 'tools service is not available' }
  ctx.inject(['tools'], (scoped) => {
    const tools = scoped.tools as { register(definition: unknown): unknown } | undefined
    if (tools === undefined) return
    try {
      tools.register(createPushTool(deps))
      state = { registered: true }
    } catch (error) {
      state = { registered: false, error: error instanceof Error ? error.message : String(error) }
      deps.logger.error('[push] push_message registration failed: %s', state.error)
    }
  })
  return () => state
}
