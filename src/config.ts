/** Plugin configuration: the schema cordis validates and the settings page edits. */
import z from '@deepseek-ai/schemastery'

/** Event switches. */
export interface EventSwitches {
  readonly conversationCompleted: boolean
  readonly conversationPaused: boolean
  readonly conversationFailed: boolean
  readonly authorizationRequired: boolean
  readonly confirmationRequired: boolean
  readonly todoProgress: boolean
}

/** Settings every chat channel shares. */
export interface ChatChannelConfig {
  readonly enabled: boolean
  readonly defaultTargets: readonly string[]
  readonly interactive: boolean
}

/** WeChat ClawBot settings. */
export interface WechatConfig extends ChatChannelConfig {
  /** Session file holding the bot token and captured context tokens. */
  readonly sessionFile: string
}

/** WeCom AI bot settings. */
export interface WecomAibotConfig extends ChatChannelConfig {
  readonly botId: string
  readonly secret: string
  /** Private-deployment WebSocket endpoint; empty uses the official one. */
  readonly wsUrl: string
}

/** WeCom group bot settings (push only). */
export interface WecomWebhookConfig {
  readonly enabled: boolean
  readonly webhookUrl: string
  readonly mentions: readonly string[]
  readonly msgType: 'text' | 'markdown'
}

/** Which notification path a push prefers. */
export type SystemBackend = 'auto' | 'renderer' | 'host'

/** In-app (renderer) notifications: same events, its own switches. */
export interface SystemConfig {
  readonly enabled: boolean
  /** Which events also raise a system notification; independent of the chat events. */
  readonly events: EventSwitches
  /**
   * auto: the page when one is open, otherwise the OS command where it works.
   * renderer: the page only (macOS has no usable host identity).
   * host: the OS command only.
   */
  readonly backend: SystemBackend
  /** Play a short cue with the notification; the page synthesizes it, the host does not. */
  readonly sound: boolean
}

/** Complete plugin configuration. */
export interface Config {
  readonly enabled: boolean
  readonly titlePrefix: string
  readonly mainAgentOnly: boolean
  readonly events: EventSwitches
  /** Channels event notifications go to; empty means the default channel. */
  readonly push: {
    /** Recipient for `push_message`; '' means the first usable channel. */
    readonly defaultChannel: string
    /** Recipient for every automatic message; '' follows `defaultChannel`. */
    readonly autoChannel: string
    readonly replyTimeoutMs: number
  }
  readonly messages: {
    readonly locale: 'zh' | 'en'
    readonly hint: boolean
  }
  readonly system: SystemConfig
  readonly channels: {
    readonly wechat: WechatConfig
    readonly 'wecom-aibot': WecomAibotConfig
    readonly 'wecom-webhook': WecomWebhookConfig
  }
}

const schema = z.object({
  enabled: z.boolean().default(true).description('Enable pushing and chat commands.'),
  titlePrefix: z.string().default('').description('Prefix prepended to every notification title.'),
  mainAgentOnly: z.boolean().default(true).description('Silence subagent completions and progress.'),
  events: z.object({
    conversationCompleted: z.boolean().default(true),
    conversationPaused: z.boolean().default(true),
    conversationFailed: z.boolean().default(true),
    authorizationRequired: z.boolean().default(true),
    confirmationRequired: z.boolean().default(true),
    todoProgress: z.boolean().default(true),
  }).default({
    conversationCompleted: true,
    conversationPaused: true,
    conversationFailed: true,
    authorizationRequired: true,
    confirmationRequired: true,
    todoProgress: true,
  }),
  push: z.object({
    defaultChannel: z.string().default('').description('Channel used when a push names none.'),
    autoChannel: z.string().default('').description('Channel for automatic messages; empty follows the default channel.'),
    replyTimeoutMs: z.number().step(1).min(1000).max(300000).default(120000).description('Longest push_message reply wait.'),
  }).default({ defaultChannel: '', replyTimeoutMs: 120000 }),
  messages: z.object({
    locale: z.union([z.const('zh'), z.const('en')]).default('zh').description('Language of messages sent to chat.'),
    hint: z.boolean().default(true).description('Append a reply hint to notifications.'),
  }).default({ locale: 'zh', hint: true }),
  system: z.object({
    enabled: z.boolean().default(false).description('Raise a system notification for the selected events.'),
    backend: z.union([z.const('auto'), z.const('renderer'), z.const('host')]).default('auto')
      .description('auto: the page when open, else the OS command; renderer: the page only; host: the OS command only.'),
    sound: z.boolean().default(true).description('Play a short cue when a notification appears.'),
    events: z.object({
      conversationCompleted: z.boolean().default(true),
      conversationPaused: z.boolean().default(true),
      conversationFailed: z.boolean().default(true),
      authorizationRequired: z.boolean().default(true),
      confirmationRequired: z.boolean().default(true),
      todoProgress: z.boolean().default(true),
    }).default({
      conversationCompleted: true,
      conversationPaused: true,
      conversationFailed: true,
      authorizationRequired: true,
      confirmationRequired: true,
      todoProgress: true,
    }),
  }).default({
    enabled: false,
    backend: 'auto',
    events: {
      conversationCompleted: true,
      conversationPaused: true,
      conversationFailed: true,
      authorizationRequired: true,
      confirmationRequired: true,
      todoProgress: true,
    },
  }),
  channels: z.object({
    wechat: z.object({
      enabled: z.boolean().default(false),
      defaultTargets: z.array(z.string()).default([]),
      interactive: z.boolean().default(true),
      sessionFile: z.string().default(''),
    }).default({ enabled: false, defaultTargets: [], interactive: true, sessionFile: '' }),
    'wecom-aibot': z.object({
      enabled: z.boolean().default(false),
      defaultTargets: z.array(z.string()).default([]),
      interactive: z.boolean().default(true),
      botId: z.string().default(''),
      secret: z.string().default(''),
      wsUrl: z.string().default(''),
    }).default({ enabled: false, defaultTargets: [], interactive: true, botId: '', secret: '', wsUrl: '' }),
    'wecom-webhook': z.object({
      enabled: z.boolean().default(false),
      webhookUrl: z.string().default(''),
      mentions: z.array(z.string()).default([]),
      msgType: z.union([z.const('text'), z.const('markdown')]).default('markdown'),
    }).default({ enabled: false, webhookUrl: '', mentions: [], msgType: 'markdown' }),
  }).default({
    wechat: { enabled: false, defaultTargets: [], interactive: true, sessionFile: '' },
    'wecom-aibot': { enabled: false, defaultTargets: [], interactive: true, botId: '', secret: '', wsUrl: '' },
    'wecom-webhook': { enabled: false, webhookUrl: '', mentions: [], msgType: 'markdown' },
  }),
})

/** Cordis-validated schema. */
export const Config = schema as unknown as z<Config>

/**
 * Default configuration.
 *
 * Derived from the schema itself, so a new field declares its default once:
 * the schema, the type and this function can never disagree.
 */
export function defaultConfig(): Config {
  // The schema applies every default, so no field is written twice.
  return Config({} as Config)
}

/**
 * Turn a channel on the first time it receives what it needs to work.
 *
 * A blank settings page must not require "enable + save + scan": binding is the
 * act of enabling. Once a channel already had credentials, an explicit off stays
 * off and is never overridden by a later edit.
 * @param previous - configuration before this save.
 * @param next - configuration being saved.
 * @returns next, with newly-filled channels enabled.
 */
export function autoEnableOnFirstEntry(previous: Config, next: Config): Config {
  const aibot = next.channels['wecom-aibot']
  const aibotWas = previous.channels['wecom-aibot']
  const enableAibot = !aibot.enabled
    && aibot.botId.length > 0 && aibot.secret.length > 0
    && (aibotWas.botId.length === 0 || aibotWas.secret.length === 0)
  const hook = next.channels['wecom-webhook']
  const hookWas = previous.channels['wecom-webhook']
  const enableHook = !hook.enabled && hook.webhookUrl.length > 0 && hookWas.webhookUrl.length === 0
  if (!enableAibot && !enableHook) return next
  return {
    ...next,
    channels: {
      ...next.channels,
      'wecom-aibot': enableAibot ? { ...aibot, enabled: true } : aibot,
      'wecom-webhook': enableHook ? { ...hook, enabled: true } : hook,
    },
  }
}

/** Whether a value is a plain object (arrays and null are not). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Overlay one layer over another.
 *
 * Only keys the base knows are taken, so a stale settings file cannot inject
 * unknown fields into the config; plain objects merge, everything else
 * (arrays, scalars, null) replaces.
 */
function overlay(base: unknown, layer: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(layer)) return layer === undefined ? base : layer
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(base)) {
    const value = layer[key]
    if (value !== undefined) out[key] = overlay(out[key], value)
  }
  return out
}

/**
 * Merge defaults, the profile patch and the settings-page state.
 *
 * Later layers win; a layer that omits a field keeps the fallback instead of
 * dropping it (a missing wsUrl used to crash the channel at start).
 * @param patch - configuration from the profile patch layer.
 * @param stored - configuration saved by the settings page.
 * @returns the effective configuration.
 */
export function mergeConfig(patch: Config, stored: Partial<Config> | undefined): Config {
  return overlay(overlay(defaultConfig(), patch), stored ?? {}) as Config
}
