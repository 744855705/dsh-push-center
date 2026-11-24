/** Unit tests for the channel-agnostic core. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveTargets, rememberTarget } from '../lib/core/target.js'
import { parseAnswers } from '../lib/core/router.js'
import { ChannelRegistry } from '../lib/core/registry.js'
import { PushChannel } from '../lib/core/channel.js'
import type { ChannelRuntime } from '../lib/core/channel.js'
import type { Capabilities, ChannelSettings, ChannelState, ChannelStatus, DeliveryResult, KnownTarget, OutboundMessage, RenderedMessage } from '../lib/core/types.js'
import { renderWechatText } from '../lib/channels/wechat/render.js'

/** A channel with scripted state for routing tests. */
class FakeChannel extends PushChannel {
  readonly id: string
  readonly capabilities: Capabilities = {
    inbound: true, actions: 'text', maxBodyChars: 1000, auth: 'none', targets: 'chat',
  }
  readonly sent: Array<{ target: string | null; text: string }> = []
  #settings: ChannelSettings
  #configured: boolean
  #state: ChannelState
  #targets: KnownTarget[]

  constructor(id: string, options: { settings?: Partial<ChannelSettings>; configured?: boolean; state?: ChannelState; targets?: KnownTarget[] } = {}) {
    super()
    this.id = id
    this.#settings = { enabled: true, defaultTargets: [], interactive: true, ...options.settings }
    this.#configured = options.configured ?? true
    this.#state = options.state ?? 'ready'
    this.#targets = options.targets ?? []
  }

  get settings(): ChannelSettings { return this.#settings }
  get configured(): boolean { return this.#configured }
  get status(): ChannelStatus { return { state: this.#state, targets: this.#targets } }
  async open(_runtime: ChannelRuntime): Promise<void> {}
  async close(): Promise<void> {}
  protected render(message: OutboundMessage): RenderedMessage { return { text: message.body } }
  protected async transmit(target: string | null, message: RenderedMessage): Promise<DeliveryResult> {
    this.sent.push({ target, text: message.text })
    return { ok: true }
  }
}

test('resolveTargets prefers explicit, then defaults, then recent, then known', () => {
  const now = 100 * 24 * 60 * 60_000
  const known: KnownTarget[] = [
    { id: 'fresh', lastSeenAt: now - 1_000 },
    { id: 'stale', lastSeenAt: now - 25 * 60 * 60_000 },
  ]
  const caps: Capabilities = { inbound: true, actions: 'text', maxBodyChars: 100, auth: 'none', targets: 'chat' }
  const base: ChannelSettings = { enabled: true, defaultTargets: [], interactive: true }
  assert.deepEqual(resolveTargets(base, caps, known, 'explicit', now), ['explicit'])
  assert.deepEqual(resolveTargets({ ...base, defaultTargets: ['a', 'b'] }, caps, known, undefined, now), ['a', 'b'])
  assert.deepEqual(resolveTargets(base, caps, known, undefined, now), ['fresh'])
  assert.deepEqual(resolveTargets(base, caps, known, undefined, now + 25 * 60 * 60_000), ['fresh', 'stale'])
  assert.deepEqual(resolveTargets(base, caps, [], undefined, 1), [])
})

test('rememberTarget moves a repeat to the front', () => {
  const known: KnownTarget[] = [{ id: 'a', lastSeenAt: 1 }, { id: 'b', lastSeenAt: 2 }]
  const next = rememberTarget(known, 'b', 3)
  assert.deepEqual(next.map((item) => item.id), ['b', 'a'])
  assert.equal(next[0]?.lastSeenAt, 3)
})

test('a channel with no recipients reports no-target', async () => {
  const channel = new FakeChannel('x')
  const report = await channel.send({ kind: 'text', body: 'hi' })
  assert.equal(report.delivered.length, 0)
  assert.deepEqual(report.skipped, [{ channel: 'x', reason: 'no-target' }])
})

test('a send that names no channel uses the default and never fans out', async () => {
  const a = new FakeChannel('a', { targets: [{ id: 'ta', lastSeenAt: Date.now() }] })
  const b = new FakeChannel('b', { targets: [{ id: 'tb', lastSeenAt: Date.now() }] })
  const policy = { id: '' }
  const registry = new ChannelRegistry({ defaultChannelId: () => policy.id })
  registry.add(a)
  registry.add(b)

  // An explicit channel wins and nothing else sees a copy.
  const direct = await registry.send({ kind: 'text', body: 'x' }, { channel: 'b' })
  assert.equal(direct.delivered.length, 1)
  assert.equal(b.sent.length, 1)
  assert.equal(a.sent.length, 0)

  // No channel: the configured default only.
  policy.id = 'b'
  const viaDefault = await registry.send({ kind: 'text', body: 'y' })
  assert.equal(viaDefault.delivered.length, 1)
  assert.equal(b.sent.length, 2)
  assert.equal(a.sent.length, 0, 'the other usable channel must not receive a copy')

  // The configured default exists but is broken: report it, never switch channels.
  registry.reset([a, new FakeChannel('b', { targets: [{ id: 'tb', lastSeenAt: Date.now() }], configured: false })])
  const broken = await registry.send({ kind: 'text', body: 'z' })
  assert.equal(broken.delivered.length, 0)
  assert.deepEqual(broken.skipped, [{ channel: 'b', reason: 'unconfigured' }])
  assert.equal(a.sent.length, 0, 'a broken default must not leak the message to another channel')

  // An unknown explicit channel is reported, not routed elsewhere.
  const missing = await registry.send({ kind: 'text', body: 'w' }, { channel: 'missing' })
  assert.deepEqual(missing.skipped, [{ channel: 'missing', reason: 'not-ready' }])
  assert.equal(a.sent.length + b.sent.length, 2)
})

test('the unconfigured default resolves to the first usable channel', async () => {
  const off = new FakeChannel('off', { settings: { enabled: false } })
  const ready = new FakeChannel('ready', { targets: [{ id: 't', lastSeenAt: Date.now() }] })
  const registry = new ChannelRegistry({ defaultChannelId: () => '' })
  registry.add(off)
  registry.add(ready)
  const report = await registry.send({ kind: 'text', body: 'x' })
  assert.equal(report.delivered.length, 1)
  assert.equal(ready.sent.length, 1)
})

test('the delivery ledger records every attempt and keeps the newest ones', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-push-log-'))
  const log = new DeliveryLog({ path: join(dir, 'deliveries.json'), limit: 3, now: () => 1000 })
  await log.load()
  const channel = new FakeChannel('x', { targets: [{ id: 't1', lastSeenAt: Date.now() }] })
  await channel.start({
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    clock: { now: () => Date.now(), sleep: async () => {} },
    http: {},
    dataDir: dir,
    onInbound: () => {},
    logDelivery: (rows) => log.record(rows),
  } as never)
  await channel.send({ kind: 'text', body: 'hi' })
  assert.equal(log.list().length, 1)
  assert.equal(log.list()[0]?.channel, 'x')
  assert.equal(log.list()[0]?.target, 't1')
  assert.equal(log.list()[0]?.ok, true)
  assert.equal(log.list()[0]?.at, 1000)

  // A send that finds nobody still lands in the ledger with the reason.
  const empty = new FakeChannel('none')
  await empty.start({
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    clock: { now: () => Date.now(), sleep: async () => {} },
    http: {},
    dataDir: dir,
    onInbound: () => {},
    logDelivery: (rows) => log.record(rows),
  } as never)
  await empty.send({ kind: 'text', body: 'hi' })
  assert.equal(log.list()[0]?.code, 'no-target')

  await log.flush()
  const reloaded = new DeliveryLog({ path: join(dir, 'deliveries.json') })
  await reloaded.load()
  assert.equal(reloaded.list().length, 2, 'the ledger survives a restart')
  assert.equal(reloaded.list()[0]?.channel, 'none')
  rmSync(dir, { recursive: true, force: true })
})

test('the ledger records what the page did with an event', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-push-renderer-log-'))
  const log = new DeliveryLog({ path: join(dir, 'deliveries.json'), now: () => 7 })
  await log.load()
  log.recordRenderer(true, 'conversationCompleted')
  log.recordRenderer(false, 'todoProgress')
  const rows = log.list()
  assert.equal(rows.length, 2)
  assert.deepEqual(
    { channel: rows[0]?.channel, ok: rows[0]?.ok, message: rows[0]?.message },
    { channel: 'system', ok: false, message: 'in-app: todoProgress' },
  )
  assert.equal(rows[0]?.code, 'permission-denied', 'a page that could not show it is recorded as a failure')
  assert.deepEqual({ ok: rows[1]?.ok, code: rows[1]?.code }, { ok: true, code: undefined })
  await log.flush()
  rmSync(dir, { recursive: true, force: true })
})

test('an event is handled at most once, across the page memory and storage', () => {
  // Fresh event: neither cursor has seen it.
  assert.equal(shouldHandle('e2', 'e1', 'e1'), true)
  // This page instance handled it.
  assert.equal(shouldHandle('e1', 'e1', 'e0'), false)
  // Another tab persisted it first.
  assert.equal(shouldHandle('e1', 'e0', 'e1'), false)
  // An empty id is never handled.
  assert.equal(shouldHandle('', 'e1', 'e1'), false)
})

test('the delivered endpoint validates its payload and forwards the outcome', async () => {
  const seen: unknown[] = []
  let route: { handler: (req: unknown, res: unknown) => void } | undefined
  installRpc({
    inject: (_names: string[], callback: (scoped: unknown) => void) => callback({
      webServer: { register: (value: { handler: (req: unknown, res: unknown) => void }) => { route = value; return () => {} } },
    }),
  } as never, {
    getConfig: () => ({}),
    setConfig: async () => ({}),
    getStatus: () => ({}),
    reloginWechat: async () => ({}),
    startWecomAibotQr: async () => ({}),
    testChannel: async () => ({}),
    system: {
      probe: () => ({}),
      poll: () => ({ events: [], cursor: '' }),
      verify: async () => ({}),
      delivered: (input) => { seen.push(input); return { ok: true } },
      subscribe: () => () => {},
    },
  } as never)

  const call = async (payload: unknown): Promise<{ ok: boolean; error?: { message?: string } }> => {
    const http = await import('node:http')
    const server = http.createServer((request, response) => { route?.handler(request, response) })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    try {
      const response = await fetch('http://127.0.0.1:' + String(address.port) + '/dsh-push-center/system.delivered', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'r1', method: 'system.delivered', payload }),
      })
      const body = await response.json() as { result: { ok: boolean; error?: { message?: string } } }
      return body.result
    } finally {
      server.close()
    }
  }

  assert.equal((await call({ id: 'e1', shown: true, type: 'todoProgress' })).ok, true)
  assert.deepEqual(seen, [{ id: 'e1', shown: true, type: 'todoProgress' }])
  const bad = await call({ id: 'e1' })
  assert.equal(bad.ok, false)
  assert.match(bad.error?.message ?? '', /expects/)
})

test('the ledger caps its size', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-push-log-'))
  const log = new DeliveryLog({ path: join(dir, 'deliveries.json'), limit: 2, now: () => 1 })
  await log.load()
  for (const channel of ['a', 'b', 'c']) log.record([{ channel, target: 't', ok: true }])
  assert.deepEqual(log.list().map((row) => row.channel), ['c', 'b'])
  await log.flush()
  rmSync(dir, { recursive: true, force: true })
})


test('the system notifier builds one command per platform', () => {
  const mac = notificationCommand('darwin', 'Done', 'Session finished')
  assert.equal(mac?.command, 'osascript')
  assert.deepEqual(mac?.args, ['-e', 'display notification "Session finished" with title "Done"'])
  // Quotes and backslashes must survive the AppleScript literal.
  const quoted = notificationCommand('darwin', 'a "b"', 'c')?.args[1]
  assert.equal(quoted, 'display notification "c" with title "a \\"b\\""')
  const slashed = notificationCommand('darwin', 't', 'c\\d')?.args[1]
  assert.equal(slashed, 'display notification "c\\\\d" with title "t"')

  const linux = notificationCommand('linux', 'Done', 'Session finished')
  assert.equal(linux?.command, 'notify-send')
  assert.deepEqual(linux?.args, ['--app-name=DSH', 'Done', 'Session finished'])

  const win = notificationCommand('win32', 'Done', 'Session finished')
  assert.equal(win?.command, 'powershell.exe')
  assert.ok(win?.args.includes('-NonInteractive'))
  const script = win?.args[win.args.length - 1] ?? ''
  assert.ok(script.includes('<text>Done</text>'))
  assert.ok(script.includes('ToastNotificationManager'))
  // An apostrophe is doubled for the PowerShell single-quoted literal.
  assert.ok((notificationCommand('win32', "it's", 'x')?.args.at(-1) ?? '').includes("it''s"))

  // Newlines collapse so every platform prints one line.
  assert.deepEqual(notificationCommand('linux', 'a\nb', 'c\nd')?.args, ['--app-name=DSH', 'a b', 'c d'])

  assert.equal(notificationCommand('aix', 't', 'b'), undefined)
})

test('the system channel reports a platform without a notifier and never auto-selects', () => {
  const flags = { conversationCompleted: true, conversationPaused: true, conversationFailed: true, authorizationRequired: true, confirmationRequired: true, todoProgress: true }
  const unsupported = new SystemChannel({ enabled: true, events: flags }, 'aix')
  assert.equal(unsupported.configured, false)
  assert.equal(unsupported.status.state, 'error')
  assert.equal(unsupported.autoSelectable, false)

  const mac = new SystemChannel({ enabled: true, events: flags }, 'darwin')
  assert.equal(mac.configured, true)
  assert.equal(mac.status.state, 'ready')

  const off = new SystemChannel({ enabled: false, events: flags }, 'darwin')
  assert.equal(off.status.state, 'closed')
})

test('the system notifier is never picked as the automatic default', () => {
  const system = new FakeSystemChannel('system', { targets: [{ id: '', lastSeenAt: 1 }] })
  const chat = new FakeChannel('chat')
  const registry = new ChannelRegistry({ defaultChannelId: () => '' })
  registry.add(system)
  registry.add(chat)
  assert.equal(registry.defaultChannel()?.id, 'chat')

  registry.reset([new FakeChannel('chat', { settings: { enabled: false } }), system])
  assert.equal(registry.defaultChannel(), undefined, 'a notification-only channel never takes the default')
})

test('system notifications follow their own switches, not the chat ones', async () => {
  const flags = { conversationCompleted: true, conversationPaused: true, conversationFailed: true, authorizationRequired: true, confirmationRequired: true, todoProgress: true }
  const chat = new FakeChannel('chat', { targets: [{ id: 't', lastSeenAt: Date.now() }] })
  const system = new FakeSystemChannel('system', { targets: [{ id: '', lastSeenAt: 1 }] })
  const registry = new ChannelRegistry({ defaultChannelId: () => 'chat' })
  registry.add(chat)
  registry.add(system)
  const queue = new RendererQueue()
  queue.touch()
  const notifier = new Notifier({
    registry,
    router: { noteNotification: () => {}, labelSession: () => {} },
    clock: { now: () => 1, sleep: async () => {} },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    policy: {
      enabled: () => true,
      events: () => flags,
      titlePrefix: () => '',
      hint: () => true,
      channels: () => [],
      text: () => chatText('zh'),
      // The system set differs from the chat set on purpose.
      system: () => ({
        enabled: true,
        events: { ...flags, todoProgress: false },
        backend: 'auto',
        platform: 'darwin',
        enqueue: (event) => { queue.enqueue(event) },
        heartbeatAgeMs: () => queue.heartbeatAgeMs(),
      }),
    },
  } as never)

  await notifier.emit({ type: 'conversationCompleted', title: 'done', body: 'body' })
  assert.equal(chat.sent.length, 1)
  // A page that has no cursor yet still receives what is queued.
  const drained = queue.since(undefined)
  assert.equal(drained.events.length, 1)
  assert.equal(drained.events[0]?.title, 'done')
  assert.equal(queue.since('').events.length, 1, 'an empty cursor behaves like none')

  await notifier.emit({ type: 'todoProgress', title: 'progress', body: 'body' })
  assert.equal(chat.sent.length, 2, 'chat still receives the event')
  assert.equal(queue.pageOpen, true)
})

test('an event reaches an open page through the queue, never the OS command', async () => {
  const flags = { conversationCompleted: true, conversationPaused: true, conversationFailed: true, authorizationRequired: true, confirmationRequired: true, todoProgress: true }
  const chat = new FakeChannel('chat', { targets: [{ id: 't', lastSeenAt: Date.now() }] })
  const system = new FakeSystemChannel('system', { targets: [{ id: '', lastSeenAt: 1 }] })
  const registry = new ChannelRegistry({ defaultChannelId: () => 'chat' })
  registry.add(chat)
  registry.add(system)
  const queue = new RendererQueue()
  queue.touch()
  const enqueued: string[] = []
  const notifier = new Notifier({
    registry,
    router: { noteNotification: () => {}, labelSession: () => {} },
    clock: { now: () => 1, sleep: async () => {} },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    policy: {
      enabled: () => true,
      events: () => flags,
      titlePrefix: () => '',
      hint: () => true,
      channels: () => [],
      text: () => chatText('zh'),
      system: () => ({
        enabled: true,
        events: flags,
        backend: 'auto',
        platform: 'linux',
        enqueue: (event) => { enqueued.push(event.title); queue.enqueue(event) },
        heartbeatAgeMs: () => 0,
      }),
    },
  } as never)

  await notifier.emit({ type: 'conversationCompleted', title: 'done', body: 'body' })
  assert.deepEqual(enqueued, ['done'])
  const cursor = queue.since(undefined).cursor
  const first = queue.enqueue({ type: 'todoProgress', title: 'second', body: 'b' })
  assert.equal(queue.since(cursor).events.at(-1)?.id, first.id)
  assert.equal(system.sent.length, 0, 'an open page means no OS command runs')
})

test('without an open page a non-macOS host falls back to the OS command, macOS is recorded as dropped', async () => {
  const flags = { conversationCompleted: true, conversationPaused: true, conversationFailed: true, authorizationRequired: true, confirmationRequired: true, todoProgress: true }
  // The chat dispatch needs its own channel, otherwise the default would be the
  // system channel and every emit would count twice.
  const registry = new ChannelRegistry({ defaultChannelId: () => 'chat' })
  const run = async (platform: string, heartbeatAgeMs: number) => {
    const system = new FakeSystemChannel('system', { targets: [{ id: '', lastSeenAt: 1 }] })
    registry.reset([new FakeChannel('chat', { targets: [{ id: 't', lastSeenAt: Date.now() }] }), system])
    const drops: unknown[] = []
    const notifier = new Notifier({
      registry,
      router: { noteNotification: () => {}, labelSession: () => {} },
      clock: { now: () => 1, sleep: async () => {} },
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      noteDrop: (row) => { drops.push(row) },
      policy: {
        enabled: () => true,
        events: () => flags,
        titlePrefix: () => '',
        hint: () => true,
        channels: () => [],
        text: () => chatText('zh'),
        system: () => ({
          enabled: true,
          events: flags,
          backend: 'auto',
          platform,
          enqueue: () => { throw new Error('must not enqueue without a page') },
          heartbeatAgeMs: () => heartbeatAgeMs,
        }),
      },
    } as never)
    await notifier.emit({ type: 'conversationCompleted', title: 'done', body: 'body' })
    return { sent: system.sent.length, drops }
  }

  assert.deepEqual(await run('linux', 60_000), { sent: 1, drops: [] })
  assert.deepEqual(await run('win32', 60_000), { sent: 1, drops: [] })
  const mac = await run('darwin', 60_000)
  assert.equal(mac.sent, 0, 'macOS has no usable host identity')
  assert.equal(mac.drops.length, 1)
})

test('a disabled profile never queues, never routes, never calls the OS', async () => {
  const flags = { conversationCompleted: true, conversationPaused: true, conversationFailed: true, authorizationRequired: true, confirmationRequired: true, todoProgress: true }
  const chat = new FakeChannel('chat', { targets: [{ id: 't', lastSeenAt: Date.now() }] })
  const system = new FakeSystemChannel('system', { targets: [{ id: '', lastSeenAt: 1 }] })
  const registry = new ChannelRegistry({ defaultChannelId: () => 'chat' })
  registry.add(chat)
  registry.add(system)
  const calls: string[] = []
  const notifier = new Notifier({
    registry,
    router: { noteNotification: () => {}, labelSession: () => {} },
    clock: { now: () => 1, sleep: async () => {} },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    policy: {
      enabled: () => true,
      events: () => flags,
      titlePrefix: () => '',
      hint: () => true,
      channels: () => [],
      text: () => chatText('zh'),
      system: () => ({
        enabled: false,
        events: flags,
        backend: 'auto',
        platform: 'linux',
        enqueue: () => { calls.push('enqueue') },
        heartbeatAgeMs: () => { calls.push('heartbeat'); return 60_000 },
      }),
    },
  } as never)

  await notifier.emit({ type: 'conversationCompleted', title: 'done', body: 'body' })
  assert.deepEqual(calls, [], 'disabled means the system path is not even consulted')
  assert.equal(system.sent.length, 0)
  assert.equal(chat.sent.length, 1, 'chat delivery is unaffected')
})

test('the notification route prefers the page, then the OS, and never falls back across them', () => {
  assert.equal(chooseRoute({ backend: 'auto', platform: 'darwin', heartbeatAgeMs: 0 }), 'renderer')
  assert.equal(chooseRoute({ backend: 'auto', platform: 'darwin', heartbeatAgeMs: 60_000 }), 'drop')
  assert.equal(chooseRoute({ backend: 'auto', platform: 'linux', heartbeatAgeMs: 60_000 }), 'host')
  assert.equal(chooseRoute({ backend: 'renderer', platform: 'darwin', heartbeatAgeMs: 60_000 }), 'renderer')
  assert.equal(chooseRoute({ backend: 'host', platform: 'darwin', heartbeatAgeMs: 0 }), 'drop')
  assert.equal(chooseRoute({ backend: 'host', platform: 'win32', heartbeatAgeMs: 0 }), 'host')
})

test('the renderer queue drains by cursor and expires what nobody collected', () => {
  let now = 1_000
  const queue = new RendererQueue(() => now)
  assert.equal(queue.heartbeatAgeMs(), Number.POSITIVE_INFINITY)
  assert.equal(queue.pageOpen, false)

  queue.touch()
  assert.equal(queue.pageOpen, true)

  const first = queue.enqueue({ type: 'conversationCompleted', title: 'a', body: 'a' })
  const opened = queue.since(undefined)
  assert.equal(opened.events.length, 1, 'a page that never saw an id still gets the queued event')
  assert.equal(opened.events[0]?.id, first.id)
  assert.equal(opened.cursor, first.id)

  const second = queue.enqueue({ type: 'conversationCompleted', title: 'b', body: 'b' })
  assert.deepEqual(queue.since(first.id).events.map((event) => event.id), [second.id])

  now += 61_000
  assert.equal(queue.since(second.id).events.length, 0, 'events past their TTL are gone')
  assert.equal(queue.heartbeatAgeMs() > 10_000, true)
})

test('an unknown cursor never swallows what is already queued', () => {
  let now = 1_000
  const queue = new RendererQueue(() => now)
  const first = queue.enqueue({ type: 'conversationCompleted', title: 'a', body: 'a' })

  // A host restart changes every id; the page's stored cursor no longer exists.
  const restarted = queue.since('1795000000000-9')
  assert.equal(restarted.events.length, 1, 'the queued event is still delivered')
  assert.equal(restarted.events[0]?.id, first.id)
  assert.equal(restarted.cursor, first.id)

  // A known cursor only returns what came after it.
  const second = queue.enqueue({ type: 'conversationCompleted', title: 'b', body: 'b' })
  assert.deepEqual(queue.since(first.id).events.map((event) => event.id), [second.id])
  assert.deepEqual(queue.since(second.id).events, [])

  // Expired events are not resurrected for an unknown cursor either.
  now += 61_000
  assert.deepEqual(queue.since('gone').events, [])
})

test('a single-event drain keeps the event and still advances the cursor', () => {
  const event = { id: 'e5', type: 'conversationCompleted', title: 'done', body: 'b', at: 1 }
  // The host reports the newest id as the cursor; the page must handle the event
  // anyway, which is why ordering matters: handle() skips an id equal to the cursor.
  const drained = readDrain({ events: [event], cursor: 'e5' }, 'e4')
  assert.equal(drained.events.length, 1, 'the only event in the response is not swallowed')
  assert.equal(drained.events[0]?.id, 'e5')
  assert.equal(drained.cursor, 'e5')

  assert.deepEqual(readDrain({ events: [], cursor: 'e9' }, 'e4'), { events: [], cursor: 'e9' })
  assert.deepEqual(readDrain(undefined, 'e4'), { events: [], cursor: 'e4' }, 'a bare response keeps the cursor')
  assert.deepEqual(readDrain({}, 'e4'), { events: [], cursor: 'e4' })
})

test('the event route holds a stream open and pushes a notification as it happens', async () => {
  const http = await import('node:http')
  const queue = new RendererQueue()
  let route: { handler: (req: unknown, res: unknown) => void } | undefined
  installRpc({
    inject: (_names: string[], callback: (scoped: unknown) => void) => callback({
      webServer: { register: (value: { handler: (req: unknown, res: unknown) => void }) => { route = value; return () => {} } },
    }),
  } as never, {
    getConfig: () => ({ system: { enabled: true } }),
    setConfig: async () => ({}),
    getStatus: () => ({}),
    reloginWechat: async () => ({}),
    startWecomAibotQr: async () => ({}),
    testChannel: async () => ({}),
    system: {
      probe: () => ({}),
      poll: () => { queue.touch(); return { events: [], cursor: '' } },
      verify: async () => ({}),
      subscribe: (listener) => queue.subscribe(listener),
    },
  } as never)

  const server = http.createServer((request, response) => { route?.handler(request, response) })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  try {
    const response = await fetch('http://127.0.0.1:' + String(address.port) + '/dsh-push-center/events', {
      headers: { accept: 'text/event-stream' },
    })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/)
    const reader = response.body?.getReader()
    assert.ok(reader !== undefined)
    const decoder = new TextDecoder()
    let received = ''
    const first = await reader.read()
    received += decoder.decode(first.value, { stream: true })
    assert.match(received, /: connected/)

    queue.enqueue({ type: 'conversationCompleted', title: 'done', body: 'body' })
    const second = await reader.read()
    received += decoder.decode(second.value, { stream: true })
    assert.match(received, /data: \{[^}]*"title":"done"/)
    await reader.cancel()
  } finally {
    server.close()
  }
})

test('the push tool refuses to address the system notifier', async () => {
  const tool = stubPushTool()
  const result = await (tool.execute as unknown as (args: unknown, exec: unknown) => Promise<{ status: string; error?: string }>)({ text: 'x', channel: 'system' }, {})
  assert.equal(result.status, 'failed')
  assert.match(result.error ?? '', /event-driven/)
})

test('the test push is long enough to stand out', () => {
  const zh = chatText('zh')
  assert.equal(zh.testTitle('wechat'), '🧪 推送测试 · wechat')
  const body = zh.testBody('wechat', '2026/11/24 17:30:00')
  assert.equal(body.split('\n').filter((line) => line === '测试'.repeat(20)).length, 5, 'five walls of twenty 测试')
  assert.ok(body.includes('wechat'))
  assert.ok(body.includes('2026/11/24 17:30:00'))
  assert.ok(body.length > 200)
})

test('parseAnswers handles numbers, multi-select, labels and custom text', () => {
  const single = [{ id: 'q1', question: 'pick', options: [{ label: 'yes' }, { label: 'no' }] }]
  assert.deepEqual(parseAnswers(single, '2'), [{ id: 'q1', selected: ['no'] }])
  assert.deepEqual(parseAnswers(single, 'yes'), [{ id: 'q1', selected: ['yes'] }])
  assert.deepEqual(parseAnswers(single, 'maybe'), [{ id: 'q1', selected: [], custom: 'maybe' }])

  const multi = [{ id: 'q1', question: 'pick', multiSelect: true, options: [{ label: 'a' }, { label: 'b' }] }]
  assert.deepEqual(parseAnswers(multi, '1 2'), [{ id: 'q1', selected: ['a', 'b'] }])

  const two = [
    { id: 'q1', question: 'one', options: [{ label: 'a' }, { label: 'b' }] },
    { id: 'q2', question: 'two' },
  ]
  assert.deepEqual(parseAnswers(two, '1，自由回答'), [
    { id: 'q1', selected: ['a'] },
    { id: 'q2', selected: [], custom: '自由回答' },
  ])
  assert.equal(parseAnswers(single, '9'), null)
})

test('wechat rendering keeps tables packed and promotes paragraph breaks', () => {
  const rendered = renderWechatText({ title: 'T', body: '| a | b |\n| - | - |\n| 1 | 2 |\nline1\nline2' })
  assert.match(rendered.text, /\| a \| b \|\n\| - \| - \|\n\| 1 \| 2 \|/)
  assert.match(rendered.text, /line1\n\nline2/)
  const long = renderWechatText({ body: 'x'.repeat(5000) })
  assert.ok(long.text.length <= 2001)
})

/** Flatten a nested dictionary into dotted keys. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const path = prefix.length === 0 ? key : prefix + '.' + key
    if (typeof value === 'string') out[path] = value
    else if (value !== null && typeof value === 'object') Object.assign(out, flatten(value as Record<string, unknown>, path))
  }
  return out
}

test('zh and en dictionaries carry identical keys', () => {
  const zh = JSON.parse(readFileSync(new URL('../locale/zh.json', import.meta.url), 'utf8')) as { ui: Record<string, unknown> }
  const en = JSON.parse(readFileSync(new URL('../locale/en.json', import.meta.url), 'utf8')) as { ui: Record<string, unknown> }
  const zhKeys = Object.keys(flatten(zh.ui)).toSorted()
  const enKeys = Object.keys(flatten(en.ui)).toSorted()
  assert.deepEqual(zhKeys, enKeys)
})

test('client sources hold no Chinese literals', () => {
  const dir = new URL('../src/client/', import.meta.url).pathname
  const files = readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile())
  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8')
    assert.doesNotMatch(text, /[\u4e00-\u9fff]/, file + ' must not contain CJK literals')
  }
})

import { createQrClient } from '../lib/channels/wecom-aibot/qr.js'
import { AssociationFlow } from '../lib/channels/wecom-aibot/association.js'
import type { HttpClient, HttpResponse } from '../lib/core/ports.js'

/** HTTP double answering fixed JSON per path. */
class FakeHttp implements HttpClient {
  readonly calls: string[] = []
  readonly #routes: Record<string, unknown>
  constructor(routes: Record<string, unknown>) { this.#routes = routes }
  async send(url: string): Promise<HttpResponse> {
    this.calls.push(url)
    const path = url.split('?')[0] ?? url
    const body = this.#routes[path] ?? {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body }
  }
}

const log = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

test('the association client reads the QR ticket and the issued credentials', async () => {
  const http = new FakeHttp({
    'https://work.weixin.qq.com/ai/qc/generate': { data: { scode: 's-1', auth_url: 'https://qr' } },
    'https://work.weixin.qq.com/ai/qc/query_result': { data: { status: 'success', bot_info: { botid: 'bot-1', secret: 'sec-1' } } },
  })
  const client = createQrClient(http, 'test')
  const ticket = await client.start()
  assert.equal(ticket.scode, 's-1')
  assert.equal(ticket.authUrl, 'https://qr')
  assert.deepEqual(await client.poll('s-1'), { status: 'success', botId: 'bot-1', secret: 'sec-1' })
})

test('an expired association is reported, a transport blip stays pending', async () => {
  const expired = createQrClient(new FakeHttp({
    'https://work.weixin.qq.com/ai/qc/query_result': { data: { status: 'expired' } },
  }), 'test')
  assert.deepEqual(await expired.poll('s'), { status: 'expired' })

  const broken = new FakeHttp({})
  broken.send = async () => { throw new Error('socket closed') }
  const blip = createQrClient(broken, 'test')
  assert.deepEqual(await blip.poll('s'), { status: 'pending' })
})

test('the association flow saves credentials on success and times out otherwise', async () => {
  let now = 0
  const clock = { now: () => now, sleep: async (ms: number) => { now += ms } }
  const saved: Array<{ botId: string; secret: string }> = []

  const success = new AssociationFlow({
    http: new FakeHttp({}),
    clock,
    logger: log,
    intervalMs: 10,
    timeoutMs: 1000,
    client: { start: async () => ({ scode: 's', authUrl: 'u' }), poll: async () => ({ status: 'success', botId: 'b', secret: 's' }) },
    onAssociated: (credentials) => { saved.push(credentials) },
  })
  assert.equal((await success.begin()).url, 'u')
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(saved, [{ botId: 'b', secret: 's' }])
  assert.equal(success.status.phase, 'idle')
  assert.equal(typeof success.status.completedAt, 'number')

  now = 0
  const timeout = new AssociationFlow({
    http: new FakeHttp({}),
    clock,
    logger: log,
    intervalMs: 500,
    timeoutMs: 1000,
    client: { start: async () => ({ scode: 's', authUrl: 'u' }), poll: async () => ({ status: 'pending' }) },
    onAssociated: () => { throw new Error('must not associate') },
  })
  await timeout.begin()
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(timeout.status.phase, 'error')
  assert.equal(timeout.status.errorKey, 'timeout')
})

import { WechatChannel } from '../lib/channels/wechat/index.js'
import { PushError } from '../lib/core/errors.js'

test('wechat login returns immediately and exposes the QR', async () => {
  let requested = false
  const wire = {
    async requestQr() { requested = true; return { qrcode: 'q-1', url: 'https://qr.example/1' } },
    async pollLogin() { return { status: 'pending' as const } },
    async pollUpdates() { return [] },
    async sendText() {},
  }
  const channel = new WechatChannel({ enabled: true, defaultTargets: [], interactive: true, sessionFile: '' }, wire as never)
  const started = Date.now()
  await channel.start({
    logger: log,
    clock: { now: () => Date.now(), sleep: () => new Promise<void>(() => {}) },
    http: new FakeHttp({}),
    dataDir: '/tmp/dsh-push-center-test',
    onInbound: () => {},
  })
  assert.ok(Date.now() - started < 500)
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(requested, true)
  assert.equal(channel.status.state, 'opening')
  assert.deepEqual(channel.status.qr, { url: 'https://qr.example/1' })
  await channel.close()
})

import { targetFromEvent } from '../lib/channels/wecom-aibot/index.js'

test('a channel with no recipient warns instead of staying silent', async () => {
  const warnings: string[] = []
  const channel = new FakeChannel('quiet')
  await channel.start({
    logger: { debug: () => {}, info: () => {}, warn: (message: string) => { warnings.push(message) }, error: () => {} },
    clock: { now: () => 0, sleep: async () => {} },
    http: new FakeHttp({}),
    dataDir: '/tmp/dsh-push-center-test',
    onInbound: () => {},
  })
  const report = await channel.send({ kind: 'text', body: 'hi' })
  assert.deepEqual(report.skipped, [{ channel: 'quiet', reason: 'no-target' }])
  assert.equal(warnings.length, 1)
})

test('the AI bot learns its chat from a message or an enter-chat event', () => {
  assert.equal(targetFromEvent({ chatid: 'g1', from: { userid: 'u1' } }), 'g1')
  assert.equal(targetFromEvent({ from: { userid: 'u1' } }), 'u1')
  assert.equal(targetFromEvent(undefined), undefined)
})

import { mergeConfig } from '../lib/index.js'

test('config merge keeps defaults a partial patch or stored file omits', () => {
  const patch = {
    enabled: true, titlePrefix: '', mainAgentOnly: true,
    events: { conversationCompleted: true, conversationPaused: true, conversationFailed: true, authorizationRequired: true, confirmationRequired: true, todoProgress: true },
    notify: { channels: [] },
    push: { defaultChannel: '', replyTimeoutMs: 120000 },
    messages: { locale: 'zh', hint: true },
    channels: {
      wechat: { enabled: true },
      'wecom-aibot': { enabled: true, botId: 'b', secret: 's' },
      'wecom-webhook': { enabled: false },
    },
  } as never
  const fromPatch = mergeConfig(patch, undefined)
  assert.equal(fromPatch.channels['wecom-aibot'].wsUrl, '')
  assert.deepEqual([...fromPatch.channels['wecom-aibot'].defaultTargets], [])
  assert.equal(fromPatch.channels['wecom-webhook'].msgType, 'markdown')
  assert.equal(fromPatch.channels.wechat.interactive, true)

  const stored = { channels: { 'wecom-aibot': { enabled: true, botId: 'b', secret: 's', defaultTargets: [], interactive: true } } } as never
  const fromStored = mergeConfig(patch, stored)
  assert.equal(fromStored.channels['wecom-aibot'].wsUrl, '')
})

test('an expired wechat session restarts the QR login', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'push-wx-'))
  writeFileSync(join(dir, 'wechat-session.json'), JSON.stringify({ botToken: 'stale', contexts: {}, targets: [] }))
  let qrRequests = 0
  const wire = {
    async requestQr() { qrRequests += 1; return { qrcode: 'q2', url: 'https://qr/2' } },
    async pollLogin() { return { status: 'pending' as const } },
    async pollUpdates() { throw new PushError('auth-failed', 'unauthorized') },
    async sendText() {},
  }
  const channel = new WechatChannel({ enabled: true, defaultTargets: [], interactive: true, sessionFile: '' }, wire as never)
  await channel.start({
    logger: log,
    clock: { now: () => Date.now(), sleep: () => new Promise<void>(() => {}) },
    http: new FakeHttp({}),
    dataDir: dir,
    onInbound: () => {},
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(qrRequests, 1)
  assert.equal(channel.status.state, 'opening')
  assert.deepEqual(channel.status.qr, { url: 'https://qr/2' })
  await channel.close()
  rmSync(dir, { recursive: true, force: true })
})

import { buildPromptCard, cardKey, mapCardKey } from '../lib/channels/wecom-aibot/cards.js'
import { Bindings } from '../lib/core/bindings.js'
import { Waiters } from '../lib/core/waiter.js'
import { Router } from '../lib/core/router.js'
import { chatText } from '../lib/core/chat-text.js'

test('approval cards expose approve and reject buttons', () => {
  const actions = [
    { id: 'approve', label: '批准', intent: 'accept' as const },
    { id: 'reject', label: '拒绝', intent: 'reject' as const },
  ]
  const card = buildPromptCard({ title: '需要授权', body: '操作: bash', actions }, 'push-1')
  assert.equal(card.card_type, 'button_interaction')
  assert.equal(card.task_id, 'push-1')
  assert.equal(card.button_list?.length, 2)
  assert.deepEqual(card.button_list?.map((button) => button.key), ['approve', 'reject'])
})

test('card buttons cap at six and keys map back to the reply vocabulary', () => {
  const actions = Array.from({ length: 8 }, (_, index) => ({ id: 'o' + index, label: 'option ' + index, intent: 'choice' as const, value: String(index + 1) }))
  const card = buildPromptCard({ body: 'pick', actions }, 'push-2')
  assert.equal(card.button_list?.length, 6)
  assert.equal(mapCardKey('approve'), 'Y')
  assert.equal(mapCardKey('reject'), 'N')
  assert.equal(mapCardKey('choice:3'), '3')
  assert.equal(mapCardKey('command:/help'), '/help')
  assert.equal(mapCardKey('nonsense'), null)
  assert.equal(cardKey({ id: 'x', label: 'x', intent: 'accept' }, 0), 'approve')
})

test('a typed Y still approves when cards are in use', async () => {
  const registry = new ChannelRegistry({ defaultChannelId: () => 'fake' })
  const channel = new FakeChannel('fake', { targets: [{ id: 't', lastSeenAt: Date.now() }] })
  registry.add(channel)
  const router = new Router({
    registry,
    bindings: new Bindings(),
    waiters: new Waiters(),
    host: {
      prompt: async () => ({ ok: true }),
      listSessions: async () => [],
      listWorkspaces: async () => [],
      createSession: async () => ({ ok: false }),
    },
    clock: { now: () => Date.now(), sleep: async () => {} },
    logger: log,
    text: () => chatText('zh'),
    hintEnabled: () => true,
  })
  const pending = router.onApproval({ sessionId: 's1', toolName: 'bash' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  await router.route({ channel: 'fake', target: 't', text: 'Y', at: Date.now() })
  assert.equal(await pending, 'allowed-once')
})

test('a stray Y does not become conversation input', async () => {
  const registry = new ChannelRegistry({ defaultChannelId: () => 'fake' })
  const channel = new FakeChannel('fake', { targets: [{ id: 't', lastSeenAt: Date.now() }] })
  registry.add(channel)
  const prompts: string[] = []
  const router = new Router({
    registry,
    bindings: new Bindings(),
    waiters: new Waiters(),
    host: {
      prompt: async (_session: string, text: string) => { prompts.push(text); return { ok: true } },
      listSessions: async () => [],
      listWorkspaces: async () => [],
      createSession: async () => ({ ok: false }),
    },
    clock: { now: () => Date.now(), sleep: async () => {} },
    logger: log,
    text: () => chatText('zh'),
    hintEnabled: () => true,
  })
  await router.route({ channel: 'fake', target: 't', text: 'Y', at: Date.now() })
  assert.deepEqual(prompts, [])
  assert.equal(channel.sent.length, 1)
})

import { cardEventOf } from '../lib/channels/wecom-aibot/cards.js'

test('a card tap is read from the nested payload WeCom really sends', () => {
  const nested = { event: { eventtype: 'template_card_event', template_card_event: { event_key: 'approve', task_id: 't1' } } }
  assert.deepEqual(cardEventOf(nested), { eventKey: 'approve', taskId: 't1' })
  const flat = { event: { event_key: 'reject', task_id: 't2' } }
  assert.deepEqual(cardEventOf(flat), { eventKey: 'reject', taskId: 't2' })
  assert.equal(cardEventOf({ event: { eventtype: 'x' } })?.eventKey, undefined)
  assert.equal(cardEventOf(undefined), undefined)
  assert.equal(mapCardKey(cardEventOf(nested)?.eventKey), 'Y')
})

test('channels report whether they are already bound', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'push-bound-'))
  const wire = {
    async requestQr() { return { qrcode: 'q', url: 'https://qr' } },
    async pollLogin() { return { status: 'pending' as const } },
    async pollUpdates() { return new Promise<never>(() => {}) },
    async sendText() {},
  }
  const unbound = new WechatChannel({ enabled: true, defaultTargets: [], interactive: true, sessionFile: '' }, wire as never)
  assert.equal(unbound.status.bound, false)
  await unbound.relogin()
  assert.equal(unbound.status.state, 'error')

  writeFileSync(join(dir, 'wechat-session.json'), JSON.stringify({ botToken: 't', contexts: {}, targets: [] }))
  const bound = new WechatChannel({ enabled: true, defaultTargets: [], interactive: true, sessionFile: '' }, wire as never)
  await bound.start({
    logger: log,
    clock: { now: () => Date.now(), sleep: () => new Promise<void>(() => {}) },
    http: new FakeHttp({}),
    dataDir: dir,
    onInbound: () => {},
  })
  assert.equal(bound.status.bound, true)
  await bound.close()
  rmSync(dir, { recursive: true, force: true })

  const aibot = new WecomAibotChannel({ enabled: true, botId: 'b', secret: 's' })
  assert.equal(aibot.status.bound, true)
  const webhook = new WecomWebhookChannel({ enabled: true, webhookUrl: 'https://x' })
  assert.equal(webhook.status.bound, true)
  const emptyWebhook = new WecomWebhookChannel({ enabled: true })
  assert.equal(emptyWebhook.status.bound, false)
})

import { WecomAibotChannel } from '../lib/channels/wecom-aibot/index.js'
import { WecomWebhookChannel } from '../lib/channels/wecom-webhook/index.js'

import { autoEnableOnFirstEntry, defaultConfig } from '../lib/config.js'

test('the first credentials enable a channel, an explicit off stays off', () => {
  const base = defaultConfig()
  const filled = {
    ...base,
    channels: {
      ...base.channels,
      'wecom-aibot': { ...base.channels['wecom-aibot'], enabled: false, botId: 'b', secret: 's' },
    },
  }
  assert.equal(autoEnableOnFirstEntry(base, filled).channels['wecom-aibot'].enabled, true)
  assert.equal(autoEnableOnFirstEntry(filled, filled).channels['wecom-aibot'].enabled, false)

  const hook = {
    ...base,
    channels: {
      ...base.channels,
      'wecom-webhook': { ...base.channels['wecom-webhook'], enabled: false, webhookUrl: 'https://x' },
    },
  }
  assert.equal(autoEnableOnFirstEntry(base, hook).channels['wecom-webhook'].enabled, true)
  assert.equal(autoEnableOnFirstEntry(hook, hook).channels['wecom-webhook'].enabled, false)
})

import { createILinkWire } from '../lib/channels/wechat/ilink.js'
import { createPushTool } from '../lib/tool.js'
import { DeliveryLog } from '../lib/core/delivery-log.js'
import { RendererQueue, chooseRoute, readDrain, shouldHandle } from '../lib/core/renderer-queue.js'
import { installRpc } from '../lib/rpc.js'
import { Notifier } from '../lib/core/notifier.js'
import { SystemChannel, notificationCommand } from '../lib/channels/system/index.js'

test('the wechat wire sends the long-poll cursor and parses inbound messages', async () => {
  const requests: { url: string; headers: Record<string, string>; body: string }[] = []
  const payload = {
    ret: 0,
    get_updates_buf: 'c2',
    msgs: [
      { message_type: 1, from_user_id: 'u1', context_token: 'ctx', item_list: [{ type: 1, text_item: { text: 'hi' } }] },
      { message_type: 2, from_user_id: 'bot' },
    ],
  }
  const http = {
    async send(url: string, request?: { headers?: Record<string, string>; body?: string }) {
      requests.push({ url, headers: request?.headers ?? {}, body: request?.body ?? '' })
      return { ok: true, status: 200, text: async () => JSON.stringify(payload), json: async () => payload }
    },
  }
  const wire = createILinkWire(http as never, 'https://login.test')
  const result = await wire.pollUpdates('tok', 'https://bot.test', 'c1')
  assert.equal(result.cursor, 'c2')
  assert.deepEqual(result.messages, [{ user: 'u1', text: 'hi', contextToken: 'ctx' }])
  assert.equal(requests[0]?.url, 'https://bot.test/ilink/bot/getupdates')
  assert.equal(requests[0]?.headers.Authorization, 'Bearer tok')
  assert.equal(requests[0]?.headers.AuthorizationType, 'ilink_bot_token')
  assert.deepEqual(JSON.parse(requests[0]?.body ?? '{}'), { get_updates_buf: 'c1' })
})

test('the settings entry label stays a string and tabs keep their own keys', () => {
  for (const lang of ['zh', 'en']) {
    const doc = JSON.parse(readFileSync(new URL('../locale/' + lang + '.json', import.meta.url), 'utf8')) as { ui: Record<string, unknown> }
    assert.equal(typeof doc.ui.nav, 'string')
    const tabs = doc.ui.tabs as Record<string, unknown>
    assert.equal(typeof tabs.general, 'string')
    assert.equal(typeof tabs.wechat, 'string')
    assert.equal(typeof tabs.wecomAibot, 'string')
    assert.equal(typeof tabs.wecomWebhook, 'string')
  }
})

/** A channel that never takes the automatic default (like the OS notifier). */
class FakeSystemChannel extends FakeChannel {
  override readonly autoSelectable = false
}

/** Definition-only instance shared by the schema and receipt tests. */
function stubPushTool() {
  return createPushTool({
    registry: { defaultChannel: () => undefined, get: () => undefined, send: async () => ({ delivered: [], skipped: [] }) },
    router: { noteNotification: () => {}, awaitReply: async () => null },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    replyTimeoutMs: () => 1000,
  } as never)
}

test('the push_message definition compiles against the tool schema DSL', () => {
  // defineTool validates the author schema at runtime only, so typecheck cannot
  // catch an illegal keyword here: an array item must never carry `required`.
  const tool = stubPushTool()
  assert.equal(tool.name, 'push_message')
  const parameters = tool.parameters as { required: string[]; properties: Record<string, Record<string, unknown>> }
  assert.deepEqual(parameters.required, ['text'])
  const options = parameters.properties.options
  assert.equal(options?.type, 'array')
  const items = options?.items as Record<string, unknown>
  assert.equal(items.type, 'string')
  assert.equal(Object.hasOwn(items, 'required'), false)
  assert.deepEqual((tool as unknown as { output: { schema: { required: string[] } } }).output.schema.required, ['status', 'delivered', 'skipped'])
})

test('the push_message receipt names each channel and its target', () => {
  const tool = stubPushTool()
  const text = (value: unknown): string => (tool.output as unknown as {
    render: (args: unknown, value: unknown) => Array<{ text: string }>
  }).render({}, value).map((block) => block.text).join('\n')
  // A failed or skipped row still reports itself the same way it always did.
  assert.equal(
    text({
      status: 'sent',
      delivered: [
        { channel: 'wecom-aibot', target: 'YanHongBin', ok: true },
        { channel: 'wechat', target: 'u1@im.wechat', ok: false, code: 'expired', message: 'session expired' },
      ],
      skipped: [{ channel: 'wecom-webhook', reason: 'disabled' }],
    }),
    'sent to wecom-aibot/YanHongBin\nfailed on wechat (expired): session expired\nskipped wecom-webhook: disabled',
  )
  // A webhook target is a synthetic empty id, so no trailing slash appears.
  assert.equal(text({ status: 'sent', delivered: [{ channel: 'wecom-webhook', target: '', ok: true }], skipped: [] }), 'sent to wecom-webhook')
})