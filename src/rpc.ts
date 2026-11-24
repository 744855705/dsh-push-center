/** Settings RPC: the /dsh-push-center prefix route the settings page talks to. */
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Endpoint names shared with the client bundle. */
export const RPC_CHANNEL = '/dsh-push-center'
/** Live event stream a page may hold open instead of polling. */
export const EVENTS_PATH = RPC_CHANNEL + '/events'
export const RPC_ENDPOINTS = Object.freeze({
  configGet: 'config.get',
  configSet: 'config.set',
  status: 'status',
  wechatRelogin: 'wechat.relogin',
  wecomAibotQrStart: 'wecom-aibot.qr-start',
  channelTest: 'channel.test',
  systemProbe: 'system.probe',
  systemPoll: 'system.poll',
  systemDelivered: 'system.delivered',
})

/** One event handed to the page. */
export interface RendererEventLike {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly body: string
  readonly at: number
}

/** System-notification operations the page drives. */
export interface SystemHandlers {
  /** Whether notifications can be raised here, and how. */
  probe(): unknown
  /** Drain events after a cursor; also reports the page as live. */
  poll(since: string | undefined): unknown
  /** Record what the page did with one event (it owns the notification). */
  delivered(input: { id: string; shown: boolean; type?: string }): unknown
  /** Follow events live; returns the unsubscribe function. */
  subscribe(listener: (event: RendererEventLike) => void): () => void
}

/** What the route exposes. */
export interface RpcHandlers {
  getConfig(): unknown
  setConfig(patch: unknown): Promise<unknown>
  getStatus(): unknown
  reloginWechat(): Promise<unknown>
  startWecomAibotQr(): Promise<unknown>
  /** Send one test message to a channel and report what happened. */
  testChannel(channelId: string): Promise<unknown>
  /** System notification state; the page owns the permission, the host owns the queue. */
  system: SystemHandlers
}

/** The minimal web server surface this route needs. */
export interface WebServerLike {
  register(route: {
    kind: 'prefix'
    path: string
    auth?: 'required' | 'anonymous'
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

const MAX_BODY = 256 * 1024

/** Whether a value is a plain JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Write one RPC envelope. */
function respond(res: ServerResponse, rpcId: string, result: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ type: 'server-response', rpcId, result }))
}

/** Read and parse the request body. */
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.byteLength
    if (size > MAX_BODY) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** One endpoint: how to reject a bad payload, and what it does. */
interface Endpoint {
  /** Returns the refusal message, or null when the payload is acceptable. */
  readonly validate?: (payload: unknown) => string | null
  readonly run: (handlers: RpcHandlers, payload: unknown) => unknown
}

/** Read `payload.channel`; validation already guaranteed it is a string. */
function readChannel(payload: unknown): string {
  return isRecord(payload) && typeof payload.channel === 'string' ? payload.channel : ''
}

/** Read `payload.since`: an absent cursor means "whatever is queued". */
function readSince(payload: unknown): string | undefined {
  return isRecord(payload) && typeof payload.since === 'string' ? payload.since : undefined
}

/** Read a delivered-event report; validation already checked both fields. */
function readDelivered(payload: unknown): { id: string; shown: boolean; type?: string } {
  const record = isRecord(payload) ? payload : {}
  return {
    id: typeof record.id === 'string' ? record.id : '',
    shown: record.shown === true,
    ...(typeof record.type === 'string' ? { type: record.type } : {}),
  }
}

/** The settings surface, in one table instead of a dispatch chain. */
const ENDPOINTS: Readonly<Record<string, Endpoint>> = {
  [RPC_ENDPOINTS.configGet]: { run: (handlers) => handlers.getConfig() },
  [RPC_ENDPOINTS.configSet]: {
    validate: (payload) => (isRecord(payload) ? null : 'config.set expects an object'),
    run: (handlers, payload) => handlers.setConfig(payload),
  },
  [RPC_ENDPOINTS.status]: { run: (handlers) => handlers.getStatus() },
  [RPC_ENDPOINTS.channelTest]: {
    validate: (payload) => (readChannel(payload).length > 0 ? null : 'channel.test expects { channel }'),
    run: (handlers, payload) => handlers.testChannel(readChannel(payload)),
  },
  [RPC_ENDPOINTS.wecomAibotQrStart]: { run: (handlers) => handlers.startWecomAibotQr() },
  [RPC_ENDPOINTS.wechatRelogin]: { run: (handlers) => handlers.reloginWechat() },
  [RPC_ENDPOINTS.systemProbe]: { run: (handlers) => handlers.system.probe() },
  [RPC_ENDPOINTS.systemPoll]: { run: (handlers, payload) => handlers.system.poll(readSince(payload)) },
  [RPC_ENDPOINTS.systemDelivered]: {
    validate: (payload) => (isRecord(payload) && typeof payload.id === 'string' && typeof payload.shown === 'boolean'
      ? null
      : 'system.delivered expects { id, shown }'),
    run: (handlers, payload) => handlers.system.delivered(readDelivered(payload)),
  },
}

/**
 * Serve one RPC exchange.
 * @param req - the HTTP request.
 * @param res - the HTTP response.
 * @param handlers - the settings operations.
 */
async function serve(req: IncomingMessage, res: ServerResponse, handlers: RpcHandlers): Promise<void> {
  if (req.method === 'GET') {
    const pathname = (req.url ?? '').split('?', 1)[0] ?? ''
    if (pathname.endsWith('/events')) {
      serveEvents(req, res, handlers.system)
      return
    }
  }
  if (req.method !== 'POST') {
    res.writeHead(404)
    res.end('not found')
    return
  }
    let body: unknown
  try {
    body = await readBody(req)
  } catch {
    res.writeHead(400)
    res.end('body is not JSON')
    return
  }
  if (!isRecord(body) || typeof body.rpcId !== 'string' || typeof body.method !== 'string') {
    res.writeHead(400)
    res.end('invalid client-request')
    return
  }
  const rpcId = body.rpcId
  const method = body.method
  const payload = body.payload
  try {
    const endpoint = ENDPOINTS[method]
    if (endpoint === undefined) {
      respond(res, rpcId, { ok: false, error: { message: 'unknown endpoint: ' + method } })
      return
    }
    const refused = endpoint.validate?.(payload) ?? null
    if (refused !== null) {
      respond(res, rpcId, { ok: false, error: { message: refused } })
      return
    }
    respond(res, rpcId, { ok: true, value: await endpoint.run(handlers, payload) })
  } catch (error) {
    respond(res, rpcId, { ok: false, error: { message: error instanceof Error ? error.message : String(error) } })
  }
}

/** Milliseconds between keep-alive comments on an idle stream. */
const STREAM_HEARTBEAT_MS = 15_000

/**
 * Hold one event stream open for a page.
 *
 * The web server hands the handler the raw response on purpose ("may hold the
 * response open, e.g. SSE"), and its compression filter skips text/event-stream,
 * so writes reach the page as they happen.
 * @param req - the GET request.
 * @param res - the response this handler owns.
 * @param system - the queue and probe.
 */
function serveEvents(req: IncomingMessage, res: ServerResponse, system: SystemHandlers): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  res.write(': connected\n\n')
  const unsubscribe = system.subscribe((event) => {
    res.write('data: ' + JSON.stringify(event) + '\n\n')
  })
  const heartbeat = setInterval(() => {
    system.poll(undefined)
    res.write(': ping\n\n')
  }, STREAM_HEARTBEAT_MS)
  const close = (): void => {
    clearInterval(heartbeat)
    unsubscribe()
  }
  req.on('close', close)
  res.on('close', close)
}

/**
 * Mount the settings route once the web server exists.
 * @param ctx - plugin context with inject().
 * @param handlers - the settings operations.
 */
export function installRpc(
  ctx: {
    inject(names: string[], callback: (scoped: { webServer?: WebServerLike }) => void): void
  },
  handlers: RpcHandlers,
): void {
  ctx.inject(['connection', 'webServer'], (scoped) => {
    const server = scoped.webServer
    if (server === undefined || typeof server.register !== 'function') return
    server.register({
      kind: 'prefix',
      path: RPC_CHANNEL,
      auth: 'required',
      handler: (req, res) => serve(req, res, handlers),
    })
  })
}
