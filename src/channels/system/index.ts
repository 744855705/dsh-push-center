/** Operating-system notifications, one platform command per OS, no dependency. */
import { execFile } from 'node:child_process'
import { PushChannel } from '../../core/channel.js'
import type { ChannelRuntime } from '../../core/channel.js'
import type {
  ChannelSettings, ChannelState, ChannelStatus, DeliveryResult, OutboundMessage, RenderedMessage, TargetId,
} from '../../core/types.js'
import type { SystemConfig } from '../../config.js'
import { PushError } from '../../core/errors.js'

/** OS notifications are a glance, not a conversation: keep the body short. */
const MAX_BODY = 240

/** How long one notifier invocation may take before it counts as failed. */
const COMMAND_TIMEOUT_MS = 10_000

/** One shell invocation that raises an OS notification. */
export interface NotificationCommand {
  readonly command: string
  readonly args: readonly string[]
}

/** Collapse whitespace: every platform prints the same single-line summary. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Quote one AppleScript string literal. */
function appleScript(text: string): string {
  return '"' + text.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

/** Escape one value for the toast XML and its PowerShell single-quoted literal. */
function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // PowerShell single-quoted literals double the apostrophe; the toast XML
    // accepts the doubled form as plain text.
    .replace(/'/g, "''")
}

/** PowerShell that raises a Windows toast through WinRT, without BurntToast. */
function windowsScript(title: string, body: string): string {
  return [
    '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] > $null',
    '$xml = New-Object Windows.Data.Xml.Dom.XmlDocument',
    `$xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text>${title}</text><text>${body}</text></binding></visual></toast>')`,
    '$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)',
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Microsoft.Windows.PowerShell').Show($toast)",
  ].join('; ')
}

/**
 * The command that raises one OS notification, or undefined where this plugin
 * has no notifier. Pure: the tests assert every platform's argument shape.
 * @param platform - `process.platform` of the host.
 * @param title - notification title.
 * @param body - notification body; newlines collapse to spaces.
 * @returns the command and its exact arguments.
 */
export function notificationCommand(
  platform: NodeJS.Platform,
  title: string,
  body: string,
): NotificationCommand | undefined {
  const cleanTitle = flatten(title)
  const cleanBody = flatten(body)
  if (platform === 'darwin') {
    return {
      command: 'osascript',
      args: ['-e', 'display notification ' + appleScript(cleanBody) + ' with title ' + appleScript(cleanTitle)],
    }
  }
  if (platform === 'linux') {
    return { command: 'notify-send', args: ['--app-name=DSH', cleanTitle, cleanBody] }
  }
  if (platform === 'win32') {
    const script = windowsScript(xml(cleanTitle), xml(cleanBody))
    return { command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script] }
  }
  return undefined
}

/** Run one notifier command; a missing binary is a delivery failure, not a crash. */
function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, [...args], { timeout: COMMAND_TIMEOUT_MS }, (error) => {
      if (error === null) {
        resolve()
        return
      }
      const code = (error as NodeJS.ErrnoException).code
      reject(code === 'ENOENT'
        ? new PushError('notifier-missing', `${command} is not installed`)
        : new PushError('transport', `${command} failed: ${error.message}`))
    })
  })
}

/**
 * The OS notification channel.
 *
 * It is deliberately not auto-selectable and not addressable: only the event
 * switches in `config.system.events` ever reach it, so an automatic push can
 * never leak into the desktop.
 */
export class SystemChannel extends PushChannel {
  readonly id = 'system'
  override readonly autoSelectable = false
  readonly capabilities = {
    inbound: false,
    actions: 'text' as const,
    maxBodyChars: MAX_BODY,
    auth: 'none' as const,
    targets: 'webhook' as const,
  }

  readonly #config: SystemConfig
  readonly #platform: NodeJS.Platform
  #state: ChannelState = 'closed'
  #error: string | undefined

  /**
   * @param config - system notification settings.
   * @param platform - host platform, overridable in tests.
   */
  constructor(config: SystemConfig, platform: NodeJS.Platform = process.platform) {
    super()
    this.#config = {
      enabled: config.enabled ?? false,
      events: { ...config.events },
      backend: config.backend ?? 'auto',
      ...(config.verify === undefined ? {} : { verify: config.verify }),
    }
    this.#platform = platform
  }

  get settings(): ChannelSettings {
    return { enabled: this.#config.enabled, defaultTargets: [], interactive: false }
  }

  /** Whether this platform has a notifier at all. */
  override get configured(): boolean {
    return notificationCommand(this.#platform, 'probe', 'probe') !== undefined
  }

  get status(): ChannelStatus {
    if (!this.#config.enabled) return { state: 'closed', targets: [], bound: false }
    if (!this.configured) {
      return { state: 'error', error: `no system notifier for platform "${this.#platform}"`, targets: [], bound: false }
    }
    return {
      state: this.#state === 'error' ? 'error' : 'ready',
      bound: true,
      targets: [],
      ...(this.#error === undefined ? {} : { error: this.#error }),
    }
  }

  async open(runtime: ChannelRuntime): Promise<void> {
    if (!this.#config.enabled) {
      this.#state = 'closed'
      return
    }
    if (!this.configured) {
      this.#state = 'error'
      this.#error = `no system notifier for platform "${this.#platform}"`
      runtime.logger.warn('[push] system notifications are unavailable on %s', this.#platform)
      return
    }
    this.#state = 'ready'
    this.#error = undefined
  }

  async close(): Promise<void> {
    this.#state = 'closed'
  }

  protected render(message: OutboundMessage): RenderedMessage {
    const lines = message.title === undefined ? [message.body] : [message.title, message.body]
    return { text: lines.join('\n').slice(0, MAX_BODY) }
  }

  protected async transmit(_target: TargetId | null, message: RenderedMessage): Promise<DeliveryResult> {
    const [first = '', ...rest] = message.text.split('\n')
    const body = rest.join(' ')
    const title = body.length === 0 ? 'DSH' : first
    const command = notificationCommand(this.#platform, title, body.length === 0 ? first : body)
    if (command === undefined) throw new PushError('unsupported', `no system notifier for platform "${this.#platform}"`)
    await run(command.command, command.args)
    this.#state = 'ready'
    this.#error = undefined
    return { ok: true }
  }
}
