/** WeCom AI bot (智能机器人): WebSocket long connection, markdown pushes. */
import { WSClient } from '@wecom/aibot-node-sdk'
import type { WsFrame } from '@wecom/aibot-node-sdk'
import { PushChannel } from '../../core/channel.js'
import type { ChannelRuntime } from '../../core/channel.js'
import { PushError, errorMessage } from '../../core/errors.js'
import type { WecomAibotConfig } from '../../config.js'
import { JsonDocument } from '../../core/store.js'
import { truncateAtLine } from '../../core/render.js'
import { buildPromptCard, cardEventOf, mapCardKey } from './cards.js'
import { markdownBlock } from '../../core/render.js'
import type { ChannelSettings, ChannelState, ChannelStatus, DeliveryResult, KnownTarget, OutboundMessage, RenderedMessage, TargetId } from '../../core/types.js'

/** WeCom markdown bodies cap well below this. */
const MAX_BODY = 4000

/** Persisted chat list. */
interface AibotFile {
  readonly targets: KnownTarget[]
}

/** 企业微信智能机器人 channel. */
export class WecomAibotChannel extends PushChannel {
  readonly id = 'wecom-aibot'
  readonly capabilities = {
    inbound: true,
    actions: 'buttons' as const,
    maxBodyChars: MAX_BODY,
    auth: 'none' as const,
    targets: 'chat' as const,
  }

  readonly #config: WecomAibotConfig
  #client: WSClient | undefined
  #store: JsonDocument<AibotFile> | undefined
  #targets: KnownTarget[] = []
  #state: ChannelState = 'closed'
  #error: string | undefined

  readonly #welcome: string

  /**
   * @param config - channel configuration.
   * @param options - optional welcome text sent when a chat opens.
   */
  constructor(config: WecomAibotConfig, options?: { welcomeText?: string }) {
    super()
    // A persisted config may predate a field; never trust it to be complete.
    this.#config = {
      enabled: config.enabled ?? false,
      defaultTargets: config.defaultTargets ?? [],
      interactive: config.interactive ?? true,
      botId: config.botId ?? '',
      secret: config.secret ?? '',
      wsUrl: config.wsUrl ?? '',
    }
    this.#welcome = options?.welcomeText ?? 'Connected to DSH push.'
  }

  get settings(): ChannelSettings {
    return {
      enabled: this.#config.enabled,
      defaultTargets: this.#config.defaultTargets,
      interactive: this.#config.interactive,
    }
  }

  get configured(): boolean {
    return this.#config.botId.length > 0 && this.#config.secret.length > 0
  }

  get status(): ChannelStatus {
    return {
      state: this.#state,
      bound: this.configured,
      ...(this.#error === undefined ? {} : { error: this.#error }),
      targets: this.#targets,
    }
  }

  async open(runtime: ChannelRuntime): Promise<void> {
    try {
      await this.openUnsafe(runtime)
    } catch (error) {
      this.#state = 'error'
      this.#error = errorMessage(error)
      throw error
    }
  }

  async openUnsafe(runtime: ChannelRuntime): Promise<void> {
    if (!this.#config.enabled) {
      this.#state = 'closed'
      return
    }
    if (!this.configured) {
      this.#state = 'error'
      this.#error = 'Bot ID and secret are required'
      return
    }
    const store = new JsonDocument<AibotFile>(runtime.dataDir + '/wecom-aibot.json', () => ({ targets: [] }))
    this.#store = store
    this.#targets = (await store.read()).targets ?? []

    const client = new WSClient({
      botId: this.#config.botId,
      secret: this.#config.secret,
      logger: runtime.logger,
      ...(this.#config.wsUrl.length > 0 ? { wsUrl: this.#config.wsUrl } : {}),
    })
    client.on('authenticated', () => {
      this.#state = 'ready'
      this.#error = undefined
    })
    client.on('error', (error: Error) => {
      this.#state = 'error'
      this.#error = error.message
    })
    client.on('disconnected', () => {
      this.#state = 'opening'
    })
    client.on('message', (frame: WsFrame) => {
      void this.#onMessage(frame, runtime)
    })
    client.on('event.enter_chat', (frame: WsFrame) => {
      void this.#onEnterChat(frame, runtime)
    })
    client.on('event.template_card_event', (frame: WsFrame) => {
      void this.#onCardEvent(frame, runtime)
    })
    this.#client = client
    this.#state = 'opening'
    client.connect()
  }

  async close(): Promise<void> {
    this.#client?.disconnect()
    this.#client = undefined
    this.#state = 'closed'
  }

  protected render(message: OutboundMessage): RenderedMessage {
    const text = truncateAtLine(markdownBlock(message.title, message.body), MAX_BODY)
    if (message.actions === undefined || message.actions.length === 0) return { text }
    return {
      text,
      actions: message.actions,
      card: {
        ...(message.title === undefined ? {} : { title: message.title }),
        body: message.body,
        actions: message.actions,
      },
    }
  }

  protected async transmit(target: TargetId | null, message: RenderedMessage): Promise<DeliveryResult> {
    const client = this.#client
    if (client === undefined) throw new PushError('unconfigured', 'wecom-aibot channel is not open')
    if (target === null) throw new PushError('target-unknown', 'wecom-aibot needs an explicit chat id')
    if (message.card !== undefined) {
      const card = buildPromptCard(message.card, 'push-' + Date.now())
      await client.sendMessage(target, { msgtype: 'template_card', template_card: card })
      return { ok: true }
    }
    const body = { msgtype: 'markdown', markdown: { content: message.text } }
    await client.sendMessage(target, body as Parameters<WSClient['sendMessage']>[1])
    return { ok: true }
  }

  async #onMessage(frame: WsFrame, runtime: ChannelRuntime): Promise<void> {
    const body = frame.body as Record<string, unknown> | undefined
    const target = targetFromEvent(body)
    if (target === undefined) return
    const text = extractText(body ?? {})
    if (text === undefined || text.length === 0) return
    await this.#remember(target, runtime)
    this.inbound(target, text)
  }

  /** Learn the chat as soon as someone opens it, so pushes work without a message. */
  /** A button was tapped: translate it into the shared reply vocabulary. */
  async #onCardEvent(frame: WsFrame, runtime: ChannelRuntime): Promise<void> {
    const body = frame.body as Record<string, unknown> | undefined
    const card = cardEventOf(body)
    const reply = mapCardKey(card?.eventKey)
    const target = targetFromEvent(body)
    if (reply === null) {
      runtime.logger.warn('[push] wecom-aibot card event with unknown key: %s', String(card?.eventKey))
      return
    }
    if (target === undefined) {
      runtime.logger.warn('[push] wecom-aibot card event without a chat id')
      return
    }
    // Route first: the reader decision must never wait on a card refresh.
    this.inbound(target, reply)
    void this.#ackCard(frame, runtime, card?.taskId)
  }

  /** Best-effort card refresh inside WeCom's 5 second window. */
  async #ackCard(frame: WsFrame, runtime: ChannelRuntime, taskId: string | undefined): Promise<void> {
    const client = this.#client
    if (client === undefined) return
    try {
      // Bound the refresh: a missing ack must never hold a pending decision.
      await Promise.race([
        client.updateTemplateCard(frame, {
          card_type: 'button_interaction',
          main_title: { title: this.#welcome.slice(0, 20) },
          sub_title_text: 'handled',
          button_list: [],
          ...(taskId === undefined ? {} : { task_id: taskId }),
        }),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ])
    } catch (error) {
      runtime.logger.warn('[push] wecom-aibot card ack failed: %s', errorMessage(error))
    }
  }

  async #onEnterChat(frame: WsFrame, runtime: ChannelRuntime): Promise<void> {
    const body = frame.body as Record<string, unknown> | undefined
    const target = targetFromEvent(body)
    if (target === undefined) return
    await this.#remember(target, runtime)
    const client = this.#client
    if (client === undefined) return
    try {
      await client.replyWelcome(frame, { msgtype: 'text', text: { content: this.#welcome } })
    } catch (error) {
      runtime.logger.warn('[push] wecom-aibot welcome failed: %s', errorMessage(error))
    }
  }

  async #remember(target: TargetId, runtime: ChannelRuntime): Promise<void> {
    if (this.#targets.some((item) => item.id === target)) return
    this.#targets = [{ id: target, lastSeenAt: runtime.clock.now() }, ...this.#targets].slice(0, 64)
    try {
      await this.#store?.write({ targets: this.#targets })
    } catch (error) {
      runtime.logger.warn('[push] could not persist wecom-aibot chats: %s', errorMessage(error))
    }
  }
}

/**
 * The chat a message or event belongs to: the group chatid, else the sender userid.
 * @param body - the frame body.
 * @returns the target id, or undefined when the body carries none.
 */
export function targetFromEvent(body: Record<string, unknown> | undefined): string | undefined {
  if (body === undefined) return undefined
  const chatid = typeof body.chatid === 'string' && body.chatid.length > 0 ? body.chatid : undefined
  const from = body.from as { userid?: unknown } | undefined
  const userid = typeof from?.userid === 'string' && from.userid.length > 0 ? from.userid : undefined
  return chatid ?? userid
}

/** Text carried by a text or voice message body. */
function extractText(body: Record<string, unknown>): string | undefined {
  const text = body.text as { content?: unknown } | undefined
  if (typeof text?.content === 'string') return text.content
  const voice = body.voice as { content?: unknown } | undefined
  if (typeof voice?.content === 'string') return voice.content
  return undefined
}
