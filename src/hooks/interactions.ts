/** answerer waterfalls: offer approvals/questions to chat, race the browser. */
import type { Logger } from '../core/ports.js'
import type { Router } from '../core/router.js'
import type { ApprovalOutcome, ApprovalView, QuestionAnswer, QuestionItem, QuestionView } from '../core/types.js'

/** The cordis surface this bridge uses. */
export interface InteractionContextLike {
  on(name: string, listener: (...args: never[]) => unknown, options?: { prepend?: boolean }): () => void
  readonly logger: Logger
}

interface RaceOutcome<T> {
  readonly side: 'chat' | 'down'
  readonly value: T
}

/** Text of an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A string field, or undefined. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** The session behind a request agent. */
function sessionIdOf(agent: unknown): string | undefined {
  const view = agent as { id?: unknown; session?: { id?: unknown; header?: { id?: unknown } } } | undefined
  return text(view?.id) ?? text(view?.session?.id) ?? text(view?.session?.header?.id)
}

/**
 * Compose a private branch over the request signal so answering from chat can
 * cancel only the browser delivery, leaving the host's own cancellation intact.
 * @param request - the shared request object.
 * @returns the composed signal plus the browser abort, or null when unavailable.
 */
function detachBrowser(request: unknown): { signal: AbortSignal; cancel(): void } | null {
  if (request === null || typeof request !== 'object') return null
  const original = (request as { signal?: unknown }).signal
  if (original !== undefined && !(original instanceof AbortSignal)) return null
  const branch = new AbortController()
  const signal = original === undefined ? branch.signal : AbortSignal.any([original, branch.signal])
  try {
    (request as { signal?: AbortSignal }).signal = signal
  } catch {
    return null
  }
  return { signal, cancel: () => branch.abort(new Error('answered elsewhere')) }
}

/**
 * One promise settling when a request signal aborts.
 * Approvals release (delegate downstream); questions reject, because the tool
 * call awaits the outermost answerer with no timeout of its own.
 * @param signal - the request lifetime.
 * @param mode - how an abort settles the gate.
 * @returns the promise and its disposer.
 */
function abortGate(signal: AbortSignal | undefined, mode: 'release' | 'throw'): { promise: Promise<unknown>; dispose(): void } {
  if (signal === undefined) return { promise: new Promise(() => {}), dispose: () => {} }
  let fire: (() => void) | null = null
  const promise = new Promise<unknown>((resolve, reject) => {
    fire = () => { if (mode === 'release') resolve(null); else reject(signal.reason ?? new Error('request aborted')) }
    if (signal.aborted) fire()
    else signal.addEventListener('abort', fire, { once: true })
  })
  return { promise, dispose: () => { if (fire !== null) signal.removeEventListener('abort', fire) } }
}

/** Bridges DSH answerer waterfalls to the router. */
export class DshInteractions {
  readonly #ctx: InteractionContextLike
  readonly #router: Router

  /**
   * @param ctx - host context with the event bus.
   * @param router - the inbound router that owns the chat side.
   */
  constructor(ctx: InteractionContextLike, router: Router) {
    this.#ctx = ctx
    this.#router = router
  }

  /** Register both answerer listeners; returns the disposer. */
  attach(): () => void {
    const disposers: Array<() => void> = []
    try {
      disposers.push(this.#ctx.on('approval/request', ((request: unknown, next: () => Promise<unknown>) =>
        this.#approval(request, next)) as never, { prepend: true }))
    } catch (error) {
      this.#ctx.logger.warn('[push] cannot listen for approvals: %s', messageOf(error))
    }
    try {
      disposers.push(this.#ctx.on('user-questions/request', ((request: unknown, next: () => Promise<unknown>) =>
        this.#question(request, next)) as never, { prepend: true }))
    } catch (error) {
      this.#ctx.logger.warn('[push] cannot listen for questions: %s', messageOf(error))
    }
    return () => { for (const dispose of disposers) { try { dispose() } catch { /* already gone */ } } }
  }

  async #approval(request: unknown, next: () => Promise<unknown>): Promise<unknown> {
    const agent = (request as { agent?: unknown } | null)?.agent
    const sessionId = sessionIdOf(agent)
    if (sessionId === undefined) return next()
    const source = request as Record<string, unknown>
    const browser = detachBrowser(request)
    const lifetime = browser?.signal ?? (source.signal instanceof AbortSignal ? source.signal : undefined)
    const view: ApprovalView = {
      sessionId,
      toolName: text(source.toolName) ?? 'unknown tool',
      ...(text(source.callId) === undefined ? {} : { callId: text(source.callId) as string }),
      ...(text(source.reason) === undefined ? {} : { reason: text(source.reason) as string }),
      ...(lifetime === undefined ? {} : { signal: lifetime }),
    }
    const mine = this.#router.onApproval(view)
    const downstream = Promise.resolve().then(() => next())
    const gate = abortGate(view.signal, 'release')
    try {
      const winner = await Promise.race<RaceOutcome<unknown>>([
        mine.then((value) => ({ side: 'chat' as const, value })),
        downstream.then((value) => ({ side: 'down' as const, value })),
        gate.promise as Promise<RaceOutcome<unknown>>,
      ])
      if (winner.side === 'chat' && winner.value !== null) {
        browser?.cancel()
        return winner.value
      }
      this.#router.drop('approval', sessionId, view.callId)
      return winner.side === 'chat' ? downstream : winner.value
    } finally {
      gate.dispose()
    }
  }

  async #question(request: unknown, next: () => Promise<unknown>): Promise<unknown> {
    const source = request as Record<string, unknown> | null
    const sessionId = sessionIdOf(source?.agent) ?? ''
    const questions = Array.isArray(source?.questions) ? source.questions as QuestionItem[] : []
    if (questions.length === 0) return next()
    const browser = detachBrowser(request)
    const lifetime = browser?.signal ?? (source?.signal instanceof AbortSignal ? source.signal : undefined)
    const view: QuestionView = {
      sessionId,
      questions,
      ...(text((source?.wait as { callId?: unknown } | undefined)?.callId) === undefined
        ? {}
        : { callId: text((source?.wait as { callId?: unknown } | undefined)?.callId) as string }),
      ...(lifetime === undefined ? {} : { signal: lifetime }),
    }
    const mine = this.#router.onQuestion(view)
    const downstream = Promise.resolve().then(() => next())
    const gate = abortGate(view.signal, 'throw')
    try {
      const winner = await Promise.race<RaceOutcome<unknown>>([
        mine.then((value) => ({ side: 'chat' as const, value })),
        downstream.then((value) => ({ side: 'down' as const, value })),
        gate.promise as Promise<RaceOutcome<unknown>>,
      ])
      if (winner.side === 'chat' && winner.value !== null) {
        browser?.cancel()
        return winner.value
      }
      this.#router.drop('question', sessionId, view.callId)
      return winner.side === 'chat' ? downstream : winner.value
    } catch (error) {
      this.#router.drop('question', sessionId, view.callId)
      throw error
    } finally {
      gate.dispose()
    }
  }
}

/** Re-export for callers that only need the outcome type. */
export type { ApprovalOutcome, QuestionAnswer }
