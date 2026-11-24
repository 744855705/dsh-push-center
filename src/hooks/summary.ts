/** Turn summary: what the human asked and what the agent answered. */

/** Structural session facts this module reads. */
export interface SessionLike {
  readonly id?: string
  readonly log?: readonly unknown[]
  readonly firstLiveSeq?: number
  snapshotEvents?(): readonly unknown[]
  readonly header?: { readonly cwd?: string; readonly origin?: string; readonly delegationDepth?: number }
}

interface EventLike {
  readonly type?: string
  readonly seq?: number
  readonly time?: number
  readonly data?: Record<string, unknown>
}

/** What one finished turn looked like. */
export interface TurnSummary {
  readonly body: string
  readonly workspace?: string
  readonly title?: string
  readonly userPrompt?: string
  readonly reply?: string
  readonly tools?: readonly string[]
  readonly steps?: number
  readonly durationMs?: number
  readonly sessionId?: string
}

/** Workspace label: basename of the session cwd. */
export function workspaceOf(session: SessionLike): string | undefined {
  const cwd = session.header?.cwd
  if (cwd === undefined || cwd.length === 0) return undefined
  const parts = cwd.split('/').filter((part) => part.length > 0)
  return parts[parts.length - 1] ?? cwd
}

/** Whether the session is a delegated subagent. */
export function isSubagentSession(session: SessionLike): boolean {
  const header = session.header
  if (header === undefined) return false
  if (header.origin === 'subagent') return true
  return typeof header.delegationDepth === 'number' && header.delegationDepth > 0
}

/** Flatten text content blocks; reasoning blocks never leak into a push. */
function blocksToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: string; text?: string } => typeof block === 'object' && block !== null)
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join(' ')
    .trim()
}

/** Host-injected context rather than the human's own words. */
function isInjected(text: string): boolean {
  const trimmed = text.trimStart()
  return trimmed.startsWith('<') || trimmed.startsWith('Current runtime context')
}

/** Collapse whitespace runs but keep paragraph structure. */
function tidy(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/** Cut at a line boundary near the limit. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text
  const newline = text.lastIndexOf('\n', max)
  const at = newline >= Math.floor(max * 0.6) ? newline : max
  return text.slice(0, at).trimEnd() + '…'
}

/**
 * Describe the turn that just ended.
 * @param session - the session instance.
 * @param turn - the turn number.
 * @returns the push body plus structured details.
 */
export function summarizeTurn(session: SessionLike, turn: number): TurnSummary {
  const raw = typeof session.snapshotEvents === 'function'
    ? session.snapshotEvents()
    : Array.isArray(session.log) ? session.log : []
  const all = raw as EventLike[]
  const firstLive = typeof session.firstLiveSeq === 'number' ? session.firstLiveSeq : 0
  const live = firstLive > 0 ? all.filter((event) => typeof event.seq === 'number' && (event.seq as number) >= firstLive) : all
  const inTurn = live.filter((event) => event.type === 'turn/start' || event.data?.turn === turn || event.data?.turn === undefined)

  let userPrompt = ''
  let reply = ''
  const tools = new Map<string, number>()
  let steps = 0
  let started: number | undefined
  for (const event of inTurn) {
    if (event.type === 'user/message') {
      const source = event.data?.source as { kind?: unknown } | undefined
      if (typeof source?.kind === 'string' && source.kind !== 'user') continue
      const text = blocksToText(event.data?.content)
      if (text.length > 0 && !isInjected(text)) userPrompt = text
      continue
    }
    if (event.type === 'assistant/message') {
      const message = event.data?.message as { content?: unknown } | undefined
      const text = blocksToText(message?.content)
      if (text.length > 0) reply = text
      continue
    }
    if (event.type === 'tool/call' && typeof event.data?.name === 'string') {
      const name = event.data.name
      tools.set(name, (tools.get(name) ?? 0) + 1)
      continue
    }
    if (event.type === 'step/start') steps += 1
    if (event.type === 'turn/start' && typeof event.time === 'number') started = event.time
  }

  let title: string | undefined
  for (const event of all) {
    if (event.type === 'session/title' && typeof event.data?.title === 'string') title = event.data.title
  }

  const last = inTurn[inTurn.length - 1]
  const durationMs = started !== undefined && typeof last?.time === 'number' ? last.time - started : undefined

  const lines: string[] = []
  if (userPrompt.length > 0) lines.push('💬 ' + cut(tidy(userPrompt), 200))
  if (reply.length > 0) lines.push('🤖 ' + cut(tidy(reply), 500))

  return {
    body: lines.join('\n'),
    ...(workspaceOf(session) === undefined ? {} : { workspace: workspaceOf(session) as string }),
    ...(title === undefined ? {} : { title }),
    ...(userPrompt.length === 0 ? {} : { userPrompt }),
    ...(reply.length === 0 ? {} : { reply }),
    ...(tools.size === 0 ? {} : { tools: [...tools.entries()].map(([name, count]) => count > 1 ? name + '×' + count : name) }),
    ...(steps === 0 ? {} : { steps }),
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(session.id === undefined ? {} : { sessionId: session.id }),
  }
}
