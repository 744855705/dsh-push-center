/** Pending "waiting for a chat reply" tickets used by push_message. */
import type { ChannelId, TargetId } from './types.js'

/** A reply that satisfied a waiter. */
export interface WaiterReply {
  readonly text: string
  readonly target: TargetId
  readonly at: number
}

/** Why a wait ended without a reply. */
export type WaiterFailure = 'timeout' | 'aborted'

/** One open wait. */
export interface Waiter {
  readonly id: string
  readonly channel: ChannelId
  readonly targets: readonly TargetId[]
  readonly promise: Promise<WaiterReply | null>
  cancel(reason: WaiterFailure): void
}

/** Registry of open waits, keyed by an opaque id. */
export class Waiters {
  readonly #open = new Map<string, {
    channel: ChannelId
    targets: ReadonlySet<TargetId>
    settle: (reply: WaiterReply | null, reason?: WaiterFailure) => void
    cleanup: () => void
  }>()
  #next = 0

  /**
   * Open a wait for the next reply on one channel.
   * @param channel - the channel expected to answer.
   * @param targets - conversations whose reply counts.
   * @param timeoutMs - longest wait before 'timeout'.
   * @param signal - caller cancellation.
   * @returns the waiter handle.
   */
  open(channel: ChannelId, targets: readonly TargetId[], timeoutMs: number, signal?: AbortSignal): Waiter {
    this.#next += 1
    const id = `wait-${this.#next}`
    const allowed = new Set(targets)
    let settleFn: ((reply: WaiterReply | null, reason?: WaiterFailure) => void) | undefined
    const promise = new Promise<WaiterReply | null>((resolve) => {
      settleFn = (reply, reason?: WaiterFailure) => {
        this.#open.delete(id)
        if (reason !== undefined) resolve(null)
        else resolve(reply)
      }
    })
    const timer = setTimeout(() => {
      settleFn?.(null, 'timeout')
    }, timeoutMs)
    const onAbort = (): void => {
      settleFn?.(null, 'aborted')
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    const cleanup = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      this.#open.delete(id)
    }
    this.#open.set(id, { channel, targets: allowed, settle: settleFn as (reply: WaiterReply | null, reason?: WaiterFailure) => void, cleanup })
    return {
      id,
      channel,
      targets: [...targets],
      promise,
      cancel: (reason: WaiterFailure) => {
        const entry = this.#open.get(id)
        if (entry === undefined) return
        entry.cleanup()
        entry.settle(null, reason)
      },
    }
  }

  /**
   * Hand one inbound reply to the newest matching waiter.
   * @param channel - the channel the reply came from.
   * @param target - the conversation it came from.
   * @param text - the reply text.
   * @param at - arrival time.
   * @returns whether a waiter consumed it.
   */
  settle(channel: ChannelId, target: TargetId, text: string, at: number): boolean {
    for (const [id, entry] of [...this.#open.entries()].toReversed()) {
      if (entry.channel !== channel || !entry.targets.has(target)) continue
      this.#open.delete(id)
      entry.cleanup()
      entry.settle({ text, target, at })
      return true
    }
    return false
  }

  /** Number of open waits (diagnostics). */
  get size(): number {
    return this.#open.size
  }

  /** Release every open wait. */
  dispose(): void {
    for (const entry of this.#open.values()) {
      entry.cleanup()
      entry.settle(null, 'aborted')
    }
    this.#open.clear()
  }
}
