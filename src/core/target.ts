/** Recipient resolution shared by every channel. */
import type { Capabilities, ChannelSettings, KnownTarget, TargetId } from './types.js'

/** How long a conversation counts as recently active for default routing. */
export const RECENT_TARGET_MS = 24 * 60 * 60_000

/**
 * Resolve who a message goes to, in the documented order:
 * explicit target, the channel's configured defaults, conversations heard from
 * in the last day, every known conversation, nothing.
 *
 * @param settings - the channel's conversation settings.
 * @param capabilities - the channel's addressing model.
 * @param known - conversations the channel has heard from.
 * @param explicit - a caller-supplied target, when one was given.
 * @param now - current epoch milliseconds.
 * @returns the resolved targets; empty means nothing can be delivered.
 */
export function resolveTargets(
  settings: ChannelSettings,
  capabilities: Capabilities,
  known: readonly KnownTarget[],
  explicit?: TargetId,
  now = Date.now(),
): TargetId[] {
  if (explicit !== undefined && explicit.length > 0) return [explicit]
  // A webhook has no addressing: one synthetic target identifies the endpoint.
  if (capabilities.targets === 'webhook') return ['']
  if (settings.defaultTargets.length > 0) return [...settings.defaultTargets]
  const recent = known.filter((target) => now - target.lastSeenAt <= RECENT_TARGET_MS)
  if (recent.length > 0) return recent.map((target) => target.id)
  if (known.length > 0) return known.map((target) => target.id)
  return []
}

/**
 * Record one inbound conversation, keeping the newest 64 and moving a repeat to
 * the front so "most recent" stays meaningful.
 *
 * @param known - current known conversations.
 * @param id - the conversation that just spoke.
 * @param now - current epoch milliseconds.
 * @param label - optional display label.
 * @returns the updated list, newest first.
 */
export function rememberTarget(
  known: readonly KnownTarget[],
  id: TargetId,
  now: number,
  label?: string,
): KnownTarget[] {
  const rest = known.filter((target) => target.id !== id)
  const next: KnownTarget = label === undefined ? { id, lastSeenAt: now } : { id, label, lastSeenAt: now }
  return [next, ...rest].slice(0, 64)
}
