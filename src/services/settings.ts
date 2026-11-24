/**
 * Settings-page operations.
 *
 * Lives outside the composition root so the plugin entry only wires things:
 * every rule the page depends on (what a test push contains, what binding
 * implies, which platform can raise a notification) is decided here.
 */
import type { DeliveryLog } from '../core/delivery-log.js'
import type { Config as PluginConfig } from '../config.js'
import type { ChannelRegistry } from '../core/registry.js'
import type { RendererQueue } from '../core/renderer-queue.js'
import type { RpcHandlers } from '../rpc.js'
import { chatText } from '../core/chat-text.js'
import { WechatChannel } from '../channels/wechat/index.js'
import { hostNotifierAvailable } from '../core/platform.js'

/** What the settings operations need from the plugin. */
export interface SettingsDeps {
  readonly registry: ChannelRegistry
  readonly deliveries: DeliveryLog
  readonly queue: RendererQueue
  /** The effective configuration, read at call time. */
  readonly config: () => PluginConfig
  /** Persist a settings patch; merging and first-entry enabling already happened. */
  readonly saveConfig: (patch: unknown) => Promise<PluginConfig>
  /** Turn one chat channel on without touching the others. */
  readonly enableChannel: (id: 'wechat' | 'wecom-aibot') => Promise<PluginConfig>
  readonly revision: () => number
  readonly tool: () => { readonly registered: boolean; readonly error?: string }
  readonly associationStatus: () => unknown
  readonly beginAssociation: () => Promise<unknown>
}

/**
 * Create the settings handlers.
 * @param deps - the plugin surfaces these operations drive.
 * @returns the RPC handler set.
 */
export function createSettingsHandlers(deps: SettingsDeps): RpcHandlers {
  const text = (): ReturnType<typeof chatText> => chatText(deps.config().messages.locale)

  return {
    getConfig: () => deps.config(),

    setConfig: async (value) => deps.saveConfig(value),

    getStatus: () => {
      const config = deps.config()
      const platform = process.platform
      return {
        revision: deps.revision(),
        defaultChannel: deps.registry.defaultChannel()?.id ?? '',
        association: deps.associationStatus(),
        tool: deps.tool(),
        deliveries: deps.deliveries.list(),
        system: {
          enabled: config.system.enabled,
          backend: config.system.backend,
          platform,
          pageOpen: deps.queue.pageOpen,
          hostSupported: hostNotifierAvailable(platform),
        },
        channels: deps.registry.all().map((channel) => ({
          id: channel.id,
          enabled: channel.enabled,
          configured: channel.configured,
          ...channel.status,
        })),
      }
    },

    startWecomAibotQr: async () => {
      if (!deps.config().channels['wecom-aibot'].enabled) await deps.enableChannel('wecom-aibot')
      return deps.beginAssociation()
    },

    system: {
      probe: () => {
        const config = deps.config()
        const platform = process.platform
        return {
          enabled: config.system.enabled,
          backend: config.system.backend,
          platform,
          hostSupported: hostNotifierAvailable(platform),
          pageOpen: deps.queue.pageOpen,
          queued: deps.queue.since(undefined).events.length,
        }
      },
      poll: (since) => {
        deps.queue.touch()
        const drained = deps.queue.since(since)
        return { events: drained.events, cursor: drained.cursor, pageOpen: true }
      },
      delivered: (input) => {
        deps.deliveries.recordRenderer(input.shown, input.type)
        return { ok: true }
      },
      subscribe: (listener) => deps.queue.subscribe(listener),
    },

    testChannel: async (channelId) => {
      const channel = deps.registry.get(channelId)
      if (channel === undefined) return { ok: false, code: 'unknown-channel', state: 'missing', targets: 0 }
      const targets = channel.resolveRecipients()
      const state = channel.status.state
      if (!channel.usable) {
        return {
          ok: false,
          code: 'not-ready',
          state,
          targets: targets.length,
          ...(channel.status.error === undefined ? {} : { error: channel.status.error }),
        }
      }
      // A test push must survive being buried under event traffic, so it carries
      // a timestamp and a deliberately long body.
      const locale = deps.config().messages.locale
      const at = new Date().toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN', { hour12: false })
      const copy = text()
      const report = await channel.send({ kind: 'text', title: copy.testTitle(channelId), body: copy.testBody(channelId, at) })
      const first = report.delivered[0]
      if (first !== undefined) {
        return {
          ok: first.ok,
          state,
          targets: targets.length,
          ...(first.code === undefined ? {} : { code: first.code }),
          ...(first.message === undefined ? {} : { error: first.message }),
        }
      }
      const skip = report.skipped[0]
      return { ok: false, code: skip === undefined ? 'no-target' : skip.reason, state, targets: targets.length }
    },

    reloginWechat: async () => {
      const channel = deps.registry.get('wechat')
      if (!deps.config().channels.wechat.enabled || !(channel instanceof WechatChannel)) {
        // Binding is the act of enabling: one click turns the channel on and starts the scan.
        await deps.enableChannel('wechat')
        return deps.registry.get('wechat')?.status ?? { state: 'opening', targets: [] }
      }
      await channel.relogin()
      return channel.status
    },
  }
}
