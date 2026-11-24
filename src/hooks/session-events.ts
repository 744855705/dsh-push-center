/** Session lifecycle → push events. */
import type { Logger } from '../core/ports.js'
import type { Notifier, NotifyEvent } from '../core/notifier.js'
import { isSubagentSession, summarizeTurn, workspaceOf, type SessionLike } from './summary.js'

/** What this hook needs from the host and configuration. */
export interface SessionEventsDeps {
  readonly on: (name: string, listener: (session: SessionLike, event: Record<string, unknown>) => void) => () => void
  readonly logger: Logger
  readonly notifier: Notifier
  readonly mainAgentOnly: () => boolean
  readonly locale: () => 'zh' | 'en'
}

interface TodoItem { content?: unknown; status?: unknown }

/** Wording of event titles per chat language. */
const TITLES = {
  zh: {
    completed: '对话完成',
    paused: '对话暂停',
    failed: '对话失败',
    approval: '需要授权',
    question: '需要回答',
    todo: 'TODO 进度',
  },
  en: {
    completed: 'Conversation completed',
    paused: 'Conversation paused',
    failed: 'Conversation failed',
    approval: 'Approval required',
    question: 'Question waiting',
    todo: 'Task progress',
  },
} as const

/** With workspace: '[ws] label'; without: 'label'. */
function titled(workspace: string | undefined, label: string): string {
  return workspace === undefined ? label : '[' + workspace + '] ' + label
}

/** Translate session events into pushes. */
export class SessionEvents {
  readonly #deps: SessionEventsDeps
  readonly #todos = new Map<string, string>()

  /** @param deps - bus, notifier and configuration accessors. */
  constructor(deps: SessionEventsDeps) {
    this.#deps = deps
  }

  /** Subscribe; returns the disposer. */
  attach(): () => void {
    return this.#deps.on('session/event', (session, event) => { void this.#dispatch(session, event) })
  }

  async #dispatch(session: SessionLike, event: Record<string, unknown>): Promise<void> {
    const type = typeof event.type === 'string' ? event.type : ''
    const data = (event.data ?? {}) as Record<string, unknown>
    const suppressed = this.#deps.mainAgentOnly() && isSubagentSession(session)

    if (type === 'tool/call') {
      const name = typeof data.name === 'string' ? data.name : ''
      if (name === 'ask_user_question') { await this.#askQuestion(session, data); return }
      if (name === 'todo_write') {
        if (suppressed) return
        const args = parseArguments(data.arguments)
        await this.#todoProgress(session, Array.isArray(args.todos) ? args.todos as TodoItem[] : [])
      }
      return
    }

    if (type === 'todo/write') {
      if (suppressed) return
      await this.#todoProgress(session, Array.isArray(data.todos) ? data.todos as TodoItem[] : [])
      return
    }

    if (type === 'approval/asked') {
      await this.#approval(session, data)
      return
    }

    if (type !== 'turn/end') return
    if (suppressed) {
      this.#deps.logger.debug('[push] subagent turn/end suppressed')
      return
    }
    const reason = (data.reason as { kind?: unknown; error?: unknown } | undefined)
    const kind = typeof reason?.kind === 'string' ? reason.kind : 'unknown'
    const turn = typeof data.turn === 'number' ? data.turn : 0
    const summary = summarizeTurn(session, turn)
    const labels = TITLES[this.#deps.locale()]
    const workspace = summary.workspace

    if (kind === 'completed' || kind === 'max-tokens') {
      this.#emit({
        type: 'conversationCompleted',
        title: titled(workspace, '✅ ' + labels.completed),
        body: summary.body,
        ...(summary.sessionId === undefined ? {} : { sessionId: summary.sessionId }),
        ...(workspace === undefined ? {} : { workspace }),
      })
      return
    }
    if (kind === 'error') {
      const error = describeError(reason?.error)
      this.#emit({
        type: 'conversationFailed',
        title: titled(workspace, '❌ ' + labels.failed),
        body: (summary.body.length > 0 ? summary.body + '\n' : '') + 'Error: ' + error,
        ...(summary.sessionId === undefined ? {} : { sessionId: summary.sessionId }),
        ...(workspace === undefined ? {} : { workspace }),
      })
      return
    }
    this.#emit({
      type: 'conversationPaused',
      title: titled(workspace, '⏸️ ' + labels.paused),
      body: (summary.body.length > 0 ? summary.body + '\n' : '') + 'Reason: ' + kind,
      ...(summary.sessionId === undefined ? {} : { sessionId: summary.sessionId }),
      ...(workspace === undefined ? {} : { workspace }),
    })
  }

  async #askQuestion(session: SessionLike, data: Record<string, unknown>): Promise<void> {
    const args = parseArguments(data.arguments)
    const questions = Array.isArray(args.questions) ? args.questions as Array<Record<string, unknown>> : []
    const first = questions[0]
    const question = typeof first?.question === 'string' ? first.question : 'Please answer'
    const header = typeof first?.header === 'string' ? first.header : undefined
    const options = Array.isArray(first?.options)
      ? (first.options as Array<{ label?: unknown }>).map((option) => option.label).filter((label): label is string => typeof label === 'string')
      : []
    const lines: string[] = []
    if (header !== undefined) lines.push('📌 ' + header)
    lines.push('❓ ' + question)
    if (options.length > 0) lines.push('🔘 ' + options.join(' / '))
    const workspace = workspaceOf(session)
    this.#emit({
      type: 'confirmationRequired',
      title: titled(workspace, '❓ ' + TITLES[this.#deps.locale()].question),
      body: lines.join('\n'),
      ...(session.id === undefined ? {} : { sessionId: session.id }),
      ...(workspace === undefined ? {} : { workspace }),
    })
  }

  async #approval(session: SessionLike, data: Record<string, unknown>): Promise<void> {
    const tool = typeof data.toolName === 'string' ? data.toolName : 'unknown tool'
    const reason = typeof data.reason === 'string' ? data.reason : undefined
    const lines = ['🔐 ' + tool]
    if (reason !== undefined) lines.push('📝 ' + reason)
    const workspace = workspaceOf(session)
    this.#emit({
      type: 'authorizationRequired',
      title: titled(workspace, '🔐 ' + TITLES[this.#deps.locale()].approval),
      body: lines.join('\n'),
      ...(session.id === undefined ? {} : { sessionId: session.id }),
      ...(workspace === undefined ? {} : { workspace }),
    })
  }

  async #todoProgress(session: SessionLike, todos: readonly TodoItem[]): Promise<void> {
    if (todos.length === 0) return
    const total = todos.length
    const completed = todos.filter((todo) => todo.status === 'completed').length
    const inProgress = todos.filter((todo) => todo.status === 'in_progress').length
    const signature = JSON.stringify([total, completed, todos.map((todo) => (todo.status === 'completed' ? 'c' : 'o') + ':' + String(todo.content ?? ''))])
    const key = session.id ?? ''
    if (this.#todos.get(key) === signature) return
    this.#todos.set(key, signature)
    if (this.#todos.size > 200) {
      const oldest = this.#todos.keys().next().value
      if (oldest !== undefined) this.#todos.delete(oldest)
    }

    const icons: Record<string, string> = { completed: '✅', in_progress: '🔄', pending: '⬜' }
    const lines = ['📊 ' + completed + '/' + total]
    for (const todo of todos.slice(0, 10)) {
      const icon = icons[String(todo.status ?? '')] ?? '⬜'
      const content = String(todo.content ?? '')
      lines.push(icon + ' ' + (content.length > 60 ? content.slice(0, 60) + '…' : content))
    }
    if (total > 10) lines.push('… +' + (total - 10))
    const workspace = workspaceOf(session)
    this.#emit({
      type: 'todoProgress',
      title: titled(workspace, '📋 ' + TITLES[this.#deps.locale()].todo + ' ' + completed + '/' + total),
      body: lines.join('\n'),
      ...(session.id === undefined ? {} : { sessionId: session.id }),
      ...(workspace === undefined ? {} : { workspace }),
    })
    void inProgress
  }

  #emit(event: NotifyEvent): void {
    void this.#deps.notifier.emit(event).catch((error: unknown) => {
      this.#deps.logger.error('[push] notify failed: %s', error instanceof Error ? error.message : String(error))
    })
  }
}

/** Parse a tool call's JSON argument string. */
function parseArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length === 0) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** Human-readable error from a turn failure reason. */
function describeError(error: unknown): string {
  if (typeof error === 'string') return error
  const message = (error as { message?: unknown } | undefined)?.message
  if (typeof message === 'string') return message
  try {
    return JSON.stringify(error)
  } catch {
    return 'unknown error'
  }
}
