/** Approvals and questions offered to chat, and the replies that settle them. */
import type { ChatText } from './chat-text.js'
import type { ChatState } from './chat-state.js'
import type { ChannelRegistry } from './registry.js'
import type { Clock } from './ports.js'
import type { WaiterReply, Waiters } from './waiter.js'
import type {
  ApprovalOutcome, ApprovalView, ChannelId, InboundMessage, OutboundMessage, QuestionAnswer,
  QuestionAnswerItem, QuestionItem, QuestionView, TargetId,
} from './types.js'

/** An approval waiting for a chat decision. */
interface PendingApproval {
  readonly kind: 'approval'
  readonly sessionId: string
  readonly callId: string | undefined
  readonly toolName: string
  readonly reason: string | undefined
  workspace: string | undefined
  readonly createdAt: number
  readonly settle: (outcome: ApprovalOutcome | null) => void
}

/** A question batch waiting for a chat answer. */
interface PendingQuestion {
  readonly kind: 'question'
  readonly sessionId: string
  readonly questions: readonly QuestionItem[]
  workspace: string | undefined
  readonly createdAt: number
  readonly settle: (answer: QuestionAnswer | null) => void
}

/** Either kind of prompt. */
type Pending = PendingApproval | PendingQuestion

/** How long a prompt stays answerable. */
const PENDING_TTL_MS = 60 * 60_000

/** Reply vocabulary for approvals (case-insensitive). */
export const APPROVE_WORDS: ReadonlySet<string> = new Set([
  'y', 'yes', 'ok', 'approve', '允许', '批准', '同意', '好', '好的', '是', '确认',
])

/** Reply vocabulary for rejections (case-insensitive). */
export const REJECT_WORDS: ReadonlySet<string> = new Set([
  'n', 'no', 'reject', 'deny', '拒绝', '不', '不用', '否', '取消',
])

/** What the broker needs to raise prompts. */
export interface PromptDeps {
  readonly registry: ChannelRegistry
  readonly waiters: Waiters
  readonly clock: Clock
  readonly text: () => ChatText
  readonly state: ChatState
}

/**
 * Owns the prompts offered to chat.
 *
 * One prompt is outstanding at a time per session: it is queued, pushed to the
 * automatic recipient, and settled by the first reply that maps to it — or by the
 * DSH window, in which case the prompt is dropped and a late reply reports that.
 */
export class PromptBroker {
  readonly #deps: PromptDeps
  #pending: Pending[] = []

  /** @param deps - registry, waiters, clock, wording and session labels. */
  constructor(deps: PromptDeps) {
    this.#deps = deps
  }

  /** Number of answerable prompts (diagnostics). */
  get pendingCount(): number {
    return this.#pending.length
  }

  /**
   * Offer one approval to the chat and wait for the decision.
   * @param view - the host's approval request.
   * @returns the chat decision, or null when another surface answered.
   */
  async onApproval(view: ApprovalView): Promise<ApprovalOutcome | null> {
    let settle!: (outcome: ApprovalOutcome | null) => void
    const answered = new Promise<ApprovalOutcome | null>((resolve) => { settle = resolve })
    const entry: PendingApproval = {
      kind: 'approval',
      sessionId: view.sessionId,
      callId: view.callId,
      toolName: view.toolName,
      reason: view.reason,
      workspace: view.workspace,
      createdAt: this.#deps.clock.now(),
      settle,
    }
    this.#track(entry)
    if (view.workspace !== undefined) this.#deps.state.setLabel(view.sessionId, view.workspace)
    const text = this.#deps.text()
    await this.#push({
      kind: 'prompt',
      title: text.approvalTitle(entry.workspace),
      body: [text.approvalBody(entry.toolName, entry.reason), '', text.approveHint].join('\n'),
      actions: [
        { id: 'approve', label: text.approveLabel, intent: 'accept' },
        { id: 'reject', label: text.rejectLabel, intent: 'reject' },
      ],
    })
    view.signal?.addEventListener('abort', () => {
      entry.settle(null)
      this.#pending = this.#pending.filter((item) => item !== entry)
    }, { once: true })
    return answered
  }

  /**
   * Offer one question batch to the chat and wait for the answer.
   * @param view - the host's question request.
   * @returns the chat answer, or null when another surface answered.
   */
  async onQuestion(view: QuestionView): Promise<QuestionAnswer | null> {
    let settle!: (answer: QuestionAnswer | null) => void
    const answered = new Promise<QuestionAnswer | null>((resolve) => { settle = resolve })
    const entry: PendingQuestion = {
      kind: 'question',
      sessionId: view.sessionId,
      questions: view.questions,
      workspace: view.workspace,
      createdAt: this.#deps.clock.now(),
      settle,
    }
    this.#track(entry)
    if (view.workspace !== undefined) this.#deps.state.setLabel(view.sessionId, view.workspace)
    const text = this.#deps.text()
    const actions = view.questions.flatMap((question) =>
      (question.options ?? []).slice(0, 6).map((option, at) => ({
        id: `${question.id}:${at + 1}`,
        label: option.label,
        intent: 'choice' as const,
        value: String(at + 1),
      })),
    )
    await this.#push({
      kind: 'prompt',
      title: text.questionTitle(entry.workspace),
      body: text.questionBody(entry.questions),
      ...(actions.length === 0 ? {} : { actions }),
    })
    view.signal?.addEventListener('abort', () => {
      entry.settle(null)
      this.#pending = this.#pending.filter((item) => item !== entry)
    }, { once: true })
    return answered
  }

  /**
   * Another surface answered first: release the prompt so a late chat reply reports it.
   * @param kind - which prompt kind lost.
   * @param sessionId - the session it belonged to.
   * @param callId - the winning call id, when known.
   */
  drop(kind: 'approval' | 'question', sessionId: string, callId?: string): void {
    const dropped = this.#pending.filter((entry) => {
      if (entry.kind !== kind) return false
      if (entry.sessionId !== sessionId) return false
      if (entry.kind === 'approval' && callId !== undefined && entry.callId !== callId) return false
      return true
    })
    if (dropped.length === 0) return
    this.#pending = this.#pending.filter((entry) => !dropped.includes(entry))
    for (const entry of dropped) entry.settle(null)
  }

  /**
   * Hold a send open until a reply arrives on one channel.
   * @param channel - the channel that will answer.
   * @param targets - conversations whose reply counts.
   * @param timeoutMs - longest wait.
   * @param signal - caller cancellation.
   * @returns the reply, or null on timeout/abort.
   */
  async awaitReply(channel: ChannelId, targets: readonly TargetId[], timeoutMs: number, signal?: AbortSignal): Promise<WaiterReply | null> {
    return this.#deps.waiters.open(channel, targets, timeoutMs, signal).promise
  }

  /**
   * Settle the outstanding prompt with one reply.
   * @param inbound - the normalized message.
   * @param reply - the trimmed reply text.
   * @returns true when a prompt consumed the reply.
   */
  async answer(inbound: InboundMessage, reply: string): Promise<boolean> {
    const pending = this.#pending[this.#pending.length - 1]
    if (pending === undefined) return false
    if (pending.kind === 'approval') {
      await this.#answerApproval(inbound, pending, reply)
      return true
    }
    await this.#answerQuestion(inbound, pending, reply)
    return true
  }

  /** Release every pending prompt and wait. */
  dispose(): void {
    for (const entry of this.#pending) entry.settle(null)
    this.#pending = []
  }

  #track(entry: Pending): void {
    const cutoff = this.#deps.clock.now() - PENDING_TTL_MS
    this.#pending = this.#pending.filter((item) => item.createdAt >= cutoff)
    this.#pending.push(entry)
  }

  async #push(message: OutboundMessage): Promise<void> {
    // One prompt, one recipient. The registry owns the automatic switch, so a
    // disabled profile sends nothing; the entry stays pending either way: the DSH
    // window can still answer it, and a late reply must not read as new input.
    await this.#deps.registry.sendPrompt(message)
  }

  async #receipt(inbound: InboundMessage, text: string): Promise<void> {
    await this.#deps.registry.pushText(inbound.channel, inbound.target, text)
  }

  async #answerApproval(inbound: InboundMessage, entry: PendingApproval, reply: string): Promise<void> {
    const text = this.#deps.text()
    const word = reply.toLowerCase()
    const outcome: ApprovalOutcome | null = APPROVE_WORDS.has(word)
      ? 'allowed-once'
      : REJECT_WORDS.has(word) ? 'rejected' : null
    if (outcome === null) {
      await this.#receipt(inbound, text.unknownApprovalReply(reply, entry.toolName))
      return
    }
    this.#pending = this.#pending.filter((item) => item !== entry)
    entry.settle(outcome)
    const workspace = this.#deps.state.label(entry.sessionId)
    await this.#receipt(inbound, outcome === 'allowed-once'
      ? text.approveReceipt(workspace, entry.toolName)
      : text.rejectReceipt(workspace, entry.toolName))
  }

  async #answerQuestion(inbound: InboundMessage, entry: PendingQuestion, reply: string): Promise<void> {
    const text = this.#deps.text()
    const answers = parseAnswers(entry.questions, reply)
    if (answers === null) {
      await this.#receipt(inbound, text.unknownQuestionReply(reply, text.questionBody(entry.questions)))
      return
    }
    this.#pending = this.#pending.filter((item) => item !== entry)
    entry.settle({ answers })
    const summary = answers
      .map((answer) => answer.selected.join(' / ') || answer.custom || '')
      .filter((part) => part.length > 0)
      .join('; ')
    await this.#receipt(inbound, text.answerReceipt(summary))
  }
}

/**
 * Parse one reply into per-question answers.
 *
 * Multiple questions split on newlines or Chinese/Latin separators and map by
 * position; an optioned question accepts numbers (multi-select: several) or an
 * exact label; anything else becomes the custom answer.
 *
 * @param questions - the questions asked.
 * @param reply - the raw reply text.
 * @returns the answers, or null when nothing could be mapped.
 */
export function parseAnswers(questions: readonly QuestionItem[], reply: string): QuestionAnswerItem[] | null {
  const segments = questions.length > 1
    ? reply.split(/[\n，；;,]/).map((part) => part.trim()).filter((part) => part.length > 0)
    : [reply]
  if (segments.length === 0) return null

  const answers: QuestionAnswerItem[] = []
  const count = Math.min(segments.length, questions.length)
  for (let index = 0; index < count; index += 1) {
    const question = questions[index]
    const segment = segments[index]
    if (question === undefined || segment === undefined) continue
    const options = question.options ?? []
    if (options.length === 0) {
      answers.push({ id: question.id, selected: [], custom: segment })
      continue
    }
    const picks = segment.split(/[\s、]+/).filter((part) => part.length > 0)
    if (picks.length > 0 && picks.every((pick) => /^\d+$/.test(pick))) {
      const labels = picks
        .map((pick) => options[Number(pick) - 1]?.label)
        .filter((label): label is string => label !== undefined)
      if (labels.length === 0) return null
      if (question.multiSelect !== true && labels.length > 1) return null
      answers.push({ id: question.id, selected: question.multiSelect === true ? labels : [labels[0] as string] })
      continue
    }
    const byLabel = options.find((option) => option.label === segment || option.label.toLowerCase() === segment.toLowerCase())
    if (byLabel !== undefined) {
      answers.push({ id: question.id, selected: [byLabel.label] })
      continue
    }
    answers.push({ id: question.id, selected: [], custom: segment })
  }
  return answers.length === 0 ? null : answers
}
