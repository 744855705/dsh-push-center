/**
 * Golden-master tests.
 *
 * These files were captured from the build that shipped, so they freeze the
 * observable contract (defaults, merge results, RPC envelopes) instead of the
 * implementation that produces it. A refactor that changes any of them is a
 * behaviour change, not a refactor.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { defaultConfig, mergeConfig } from '../lib/index.js'
import { installRpc } from '../lib/rpc.js'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'))

/** One RPC round trip; only the shape of the answer is compared. */
type Exchange = {
  status: number
  keys: string[]
  ok: boolean | undefined
  valueType: string
  error: string | null
}

const handlers = {
  getConfig: () => ({}),
  setConfig: async () => ({}),
  getStatus: () => ({}),
  reloginWechat: async () => ({}),
  startWecomAibotQr: async () => ({}),
  testChannel: async () => ({}),
  system: {
    probe: () => ({}),
    poll: () => ({ events: [], cursor: '' }),
    delivered: () => ({ ok: true }),
    subscribe: () => () => {},
  },
}

test('the default config matches the recorded golden master', () => {
  assert.deepEqual(defaultConfig(), fixture('default-config.json'))
})

test('config merging matches the recorded golden master', () => {
  const scenarios = fixture('merge-config.json') as Array<{
    name: string
    patch: Record<string, unknown>
    stored: Record<string, unknown> | null
    result: unknown
  }>
  for (const scenario of scenarios) {
    const merged = mergeConfig(scenario.patch as never, (scenario.stored ?? undefined) as never)
    assert.deepEqual(merged, scenario.result, `scenario ${scenario.name}`)
  }
})

test('the rpc surface matches the recorded contract', async () => {
  const contract = fixture('rpc-contract.json') as {
    valid: Record<string, Exchange>
    invalid: Record<string, Exchange>
  }
  let route: { handler: (req: unknown, res: unknown) => void } | undefined
  installRpc({
    inject: (_names: string[], callback: (scoped: unknown) => void) => callback({
      webServer: { register: (value: { handler: (req: unknown, res: unknown) => void }) => { route = value; return () => {} } },
    }),
  } as never, handlers as never)
  const server = http.createServer((request, response) => { route?.handler(request, response) })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const call = async (method: string, payload: unknown): Promise<Exchange> => {
    const response = await fetch('http://127.0.0.1:' + String(address.port) + '/dsh-push-center/' + method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'r1', method, payload }),
    })
    const body = await response.json() as { result?: Record<string, unknown> }
    const result = (body.result ?? body) as { ok?: boolean; value?: unknown; error?: { message?: string } }
    return {
      status: response.status,
      keys: Object.keys(result).toSorted(),
      ok: result.ok,
      valueType: result.value === undefined ? 'undefined' : Array.isArray(result.value) ? 'array' : typeof result.value,
      error: result.error?.message ?? null,
    }
  }
  const validPayloads: Record<string, unknown> = {
    'config.get': {}, 'config.set': {}, status: {}, 'channel.test': { channel: 'x' },
    'wecom-aibot.qr-start': {}, 'wechat.relogin': {}, 'system.probe': {},
    'system.poll': { since: 'a' }, 'system.delivered': { id: 'e1', shown: true },
  }
  const invalidPayloads: Record<string, unknown> = {
    'config.set': null, 'channel.test': {}, 'system.delivered': {}, 'unknown.endpoint': {},
  }
  try {
    for (const [method, expected] of Object.entries(contract.valid)) {
      assert.deepEqual(await call(method, validPayloads[method]), expected, `valid ${method}`)
    }
    for (const [method, expected] of Object.entries(contract.invalid)) {
      assert.deepEqual(await call(method, invalidPayloads[method]), expected, `invalid ${method}`)
    }
  } finally {
    server.close()
  }
})
