/** The cordis surface this plugin drives, typed structurally. */
import type { Logger } from './core/ports.js'

/** Only the parts of the plugin context the plugin actually touches. */
export interface HostLike {
  readonly logger: Logger
  get(name: string): unknown
  on(name: string, listener: (...args: never[]) => unknown, options?: { prepend?: boolean }): () => void
  inject(names: string[], callback: (scoped: Record<string, unknown>) => void): void
  effect(callback: () => unknown, label?: string): unknown
}
