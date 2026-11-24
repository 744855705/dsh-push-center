/** Host session operations, resolved softly so a headless composition degrades. */
import { randomUUID } from 'node:crypto'
import type { CreateSessionResult, HostBridge, Logger, PromptResult, SessionSummary, WorkspaceSummary } from '../core/ports.js'

interface PromptText { readonly type: 'text'; readonly text: string }

interface SessionControllerLike {
  prompt?(request: {
    requestId: string
    sessionId: string
    mode: 'queue' | 'steer'
    content: readonly PromptText[]
    clientTimeZone?: string
  }, signal: AbortSignal): Promise<unknown>
  list?(request: Record<string, never>, signal: AbortSignal): Promise<{ items?: Array<Record<string, unknown>> }>
  create?(request: { workspaceId?: string }): Promise<{ sessionId?: string }>
}

interface SessionQueryLike {
  listSessions(signal?: AbortSignal): Promise<Array<{ header?: Record<string, unknown> }>>
}

interface AgentLike {
  status?: string
  followup?(message: unknown): void
}

interface AgentRegistryLike { get?(id: string): AgentLike | undefined }

interface SessionLike { seq?: number }

interface SessionStoreLike { get?(id: string): SessionLike | undefined }

interface WorkspaceLike { id?: unknown; path?: string; title?: string }

interface WorkspaceRegistryLike { list?(): WorkspaceLike[] }

/** The cordis surface this bridge reads. */
export interface HostContextLike {
  get(name: string): unknown
  readonly logger: Logger
}

const CLIENT_TIME_ZONE = 'Asia/Shanghai'

/** Text of an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A string field, or undefined. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Host session operations over the current DSH services. */
export class HostSessions implements HostBridge {
  readonly #ctx: HostContextLike

  /** @param ctx - the plugin's host context. */
  constructor(ctx: HostContextLike) {
    this.#ctx = ctx
  }

  /** {@inheritDoc HostBridge.prompt} */
  async prompt(sessionId: string, body: string): Promise<PromptResult> {
    const controller = this.#ctx.get('sessionController') as SessionControllerLike | undefined
    if (controller?.prompt !== undefined) {
      try {
        await controller.prompt({
          requestId: randomUUID(),
          sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: body }],
          clientTimeZone: CLIENT_TIME_ZONE,
        }, new AbortController().signal)
        return { ok: true }
      } catch (error) {
        return { ok: false, error: messageOf(error) }
      }
    }
    const agents = this.#ctx.get('agents') as AgentRegistryLike | undefined
    const agent = agents?.get?.(sessionId)
    if (agent === undefined) return { ok: false, error: 'this conversation is not running; open it in DSH first' }
    if (agent.followup === undefined) return { ok: false, error: 'this host cannot append to a conversation' }
    try {
      agent.followup({
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: body }],
        source: { kind: 'user', rpcId: randomUUID() },
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: messageOf(error) }
    }
  }

  /** {@inheritDoc HostBridge.listSessions} */
  async listSessions(): Promise<readonly SessionSummary[] | null> {
    const controller = this.#ctx.get('sessionController') as SessionControllerLike | undefined
    if (controller?.list !== undefined) {
      try {
        const result = await controller.list({}, new AbortController().signal)
        const rows = Array.isArray(result.items) ? result.items : []
        return rows.map((row) => this.#summary(row))
      } catch (error) {
        this.#ctx.logger.warn('[push] session list failed: %s', messageOf(error))
        return null
      }
    }
    const query = this.#ctx.get('sessionQuery') as SessionQueryLike | undefined
    if (query?.listSessions === undefined) return null
    try {
      const records = await query.listSessions()
      const agents = this.#ctx.get('agents') as AgentRegistryLike | undefined
      const sessions = this.#ctx.get('sessions') as SessionStoreLike | undefined
      return records.flatMap((record) => {
        const header = record.header ?? {}
        const sessionId = text(header.id)
        if (sessionId === undefined) return []
        const agent = agents?.get?.(sessionId)
        const live = sessions?.get?.(sessionId)
        return [{
          sessionId,
          updatedAt: typeof header.createdAt === 'number' ? header.createdAt : 0,
          running: agent?.status === 'running',
          blank: live?.seq === 0,
          ...(text(header.cwd) === undefined ? {} : { cwd: text(header.cwd) as string }),
          ...(header.origin === 'subagent' ? { subagent: true } : {}),
        }]
      })
    } catch (error) {
      this.#ctx.logger.warn('[push] session list failed: %s', messageOf(error))
      return null
    }
  }

  /** {@inheritDoc HostBridge.listWorkspaces} */
  async listWorkspaces(): Promise<readonly WorkspaceSummary[] | null> {
    const registry = this.#ctx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined
    if (registry?.list === undefined) return null
    try {
      return registry.list().flatMap((workspace) => {
        const id = workspace.id === undefined ? undefined : String(workspace.id)
        if (id === undefined || workspace.path === undefined) return []
        return [{ workspaceId: id, path: workspace.path, title: workspace.title ?? workspace.path }]
      })
    } catch (error) {
      this.#ctx.logger.warn('[push] workspace list failed: %s', messageOf(error))
      return null
    }
  }

  /** {@inheritDoc HostBridge.createSession} */
  async createSession(workspaceId: string): Promise<CreateSessionResult> {
    const controller = this.#ctx.get('sessionController') as SessionControllerLike | undefined
    if (controller?.create === undefined) {
      return { ok: false, error: 'this host cannot create conversations; open the workspace in DSH first' }
    }
    try {
      const created = await controller.create({ workspaceId })
      const sessionId = text(created.sessionId)
      return sessionId === undefined
        ? { ok: false, error: 'the host returned no conversation id' }
        : { ok: true, sessionId }
    } catch (error) {
      return { ok: false, error: messageOf(error) }
    }
  }

  #summary(row: Record<string, unknown>): SessionSummary {
    const title = (row.projections as { values?: { title?: unknown } } | undefined)?.values?.title
    return {
      sessionId: String(row.sessionId ?? ''),
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
      running: row.running === true,
      blank: row.blank === true,
      ...(text(row.cwd) === undefined ? {} : { cwd: text(row.cwd) as string }),
      ...(row.origin === 'subagent' ? { subagent: true } : {}),
      ...(typeof title === 'string' && title.length > 0 ? { title } : {}),
    }
  }
}
