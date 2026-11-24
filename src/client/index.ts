/** Browser half: registers the Push settings section. */
import { createElement } from 'react'
import { SettingsPage } from './SettingsPage.js'
import zh from '../../locale/zh.json'
import en from '../../locale/en.json'
import { RPC_CHANNEL, RPC_ENDPOINTS } from './rpc-contract.js'
import { startSystemNotifications } from './system-notify.js'

const NS = 'push-center'

/** Flatten a nested dictionary into the dotted keys the locale service resolves. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const path = prefix.length === 0 ? key : prefix + '.' + key
    if (typeof value === 'string') out[path] = value
    else if (value !== null && typeof value === 'object') Object.assign(out, flatten(value as Record<string, unknown>, path))
  }
  return out
}

/** RPC result the page consumes. */
export interface RpcResult {
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: { readonly message?: string }
}

/** The injected RPC caller. */
export type RpcCall = (channel: string, endpoint: string, payload: unknown) => Promise<RpcResult>

/** The browser cordis surface this entry touches. */
interface ClientContext {
  effect(callback: () => unknown, label?: string): void
  locale: {
    register(namespace: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): unknown
    bind(namespace: string): (key: string) => string
  }
  slots: {
    inject(slot: string, register: () => unknown): void
    register(meta: Record<string, unknown>, component: unknown): unknown
  }
  connection: { rpc: { call: (channel: string, endpoint: string, payload: unknown) => Promise<unknown> } }
}

/** Sidebar bell. */
function NavIcon({ size = 16 }: { size?: number }) {
  return createElement('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  }, createElement('path', {
    d: 'M12 4.3v1.2M6.6 11.4a5.4 5.4 0 0 1 10.8 0V15l1.2 2.1a.9.9 0 0 1-.8 1.4H5.9a.9.9 0 0 1-.8-1.4L6.6 15v-3.6M9.6 19a2.4 2.4 0 0 0 4.8 0',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }))
}

export const name = 'push-center'
export const inject = ['slots', 'connection', 'locale']

/** Mount the settings page. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh: flatten(zh.ui), en: flatten(en.ui) }), 'push-center: dictionaries')
  const t = ctx.locale.bind(NS)

  const rpcCall: RpcCall = async (channel, endpoint, payload) => {
    try {
      const result = await ctx.connection.rpc.call(channel, endpoint, payload) as
        | { ok?: boolean; value?: unknown; error?: { message?: string } }
        | undefined
      return {
        ok: result?.ok === true,
        ...(result?.value === undefined ? {} : { value: result.value }),
        ...(result?.error === undefined ? {} : { error: result.error }),
      }
    } catch (error) {
      return { ok: false, error: { message: error instanceof Error ? error.message : String(error) } }
    }
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'push',
    order: 60,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ rpcCall, channel: RPC_CHANNEL, endpoints: RPC_ENDPOINTS }),
  }, SettingsPage))

  // The notification agent reads the stored config once and then stays dormant
  // unless system notifications are enabled, so a disabled profile pays nothing.
  ctx.effect(() => startSystemNotifications({ call: rpcCall }), 'push-center: system notifications')

  ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
    name: 'settings.section.icon',
    id: 'push',
    order: 60,
  }, NavIcon))
}
