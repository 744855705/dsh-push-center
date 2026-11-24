/** Domain types shared by every layer; no channel or DSH import belongs here. */

/** Stable id of one channel implementation ('wechat', 'wecom-aibot', ...). */
export type ChannelId = string

/** Id of one conversation inside a channel (a user, a group, or a webhook). */
export type TargetId = string

/** Lifecycle of one channel connection. */
export type ChannelState = 'closed' | 'opening' | 'ready' | 'degraded' | 'error'

/** What a rendered action means to the reader. */
export type ActionIntent = 'accept' | 'reject' | 'choice' | 'command'

/** Shape of an outbound message. */
export type OutboundKind = 'notice' | 'prompt' | 'menu' | 'reply-request' | 'text'

/** One button/option of an outbound message. */
export interface Action {
  readonly id: string
  readonly label: string
  readonly intent: ActionIntent
  readonly value?: string
}

/** A channel-agnostic outbound message. */
export interface OutboundMessage {
  readonly kind: OutboundKind
  readonly title?: string
  readonly body: string
  readonly actions?: readonly Action[]
}

/** What a channel's renderer produces before transmission. */
export interface RenderedMessage {
  readonly text: string
  readonly actions?: readonly Action[]
  /** Optional rich form a channel may send instead of the text. */
  readonly card?: { readonly title?: string; readonly body: string; readonly actions: readonly Action[] }
}

/** One inbound message, already normalized into the shared vocabulary. */
export interface InboundMessage {
  readonly channel: ChannelId
  readonly target: TargetId
  readonly text: string
  readonly at: number
}

/** Outcome of one transmission. */
export interface DeliveryResult {
  readonly ok: boolean
  readonly code?: string
  readonly message?: string
  readonly messageId?: string
}

/** Outcome of one transmission plus its addressing. */
export interface DeliveredResult extends DeliveryResult {
  readonly channel: ChannelId
  readonly target: TargetId | null
}

/** Why a channel or target received nothing. */
export interface SkipReason {
  readonly channel: ChannelId
  readonly reason: 'disabled' | 'no-target' | 'unconfigured' | 'not-ready'
}

/** Result of sending one message through one channel. */
export interface SendReport {
  readonly delivered: readonly DeliveredResult[]
  readonly skipped: readonly SkipReason[]
}

/** A conversation the channel has heard from. */
export interface KnownTarget {
  readonly id: TargetId
  readonly label?: string
  readonly lastSeenAt: number
}

/** Observable state of one channel. */
export interface ChannelStatus {
  readonly state: ChannelState
  /** Whether this channel already holds a usable binding (token, credentials, URL). */
  readonly bound?: boolean
  readonly error?: string
  readonly targets: readonly KnownTarget[]
  readonly qr?: { readonly url: string }
}

/** Static behaviour flags a channel declares once. */
export interface Capabilities {
  /** Whether the channel can receive messages at all. */
  readonly inbound: boolean
  /** Whether approvals/questions render as real buttons or as numbered text. */
  readonly actions: 'buttons' | 'text'
  /** Longest body the channel accepts, in characters. */
  readonly maxBodyChars: number
  /** Login model: none, or an interactive QR scan. */
  readonly auth: 'none' | 'qr'
  /** Addressing model: named chats, or a single webhook endpoint. */
  readonly targets: 'chat' | 'webhook'
}

/** Per-send overrides. */
export interface SendOptions {
  readonly target?: TargetId
  readonly targets?: readonly TargetId[]
  readonly signal?: AbortSignal
}

/** Conversation-level settings every channel exposes to routing. */
export interface ChannelSettings {
  readonly enabled: boolean
  readonly defaultTargets: readonly string[]
  readonly interactive: boolean
}

/** One selectable option of a question. */
export interface QuestionOption {
  readonly label: string
  readonly description?: string
}

/** One question in an ask_user_question batch. */
export interface QuestionItem {
  readonly id: string
  readonly question: string
  readonly header?: string
  readonly detail?: string
  readonly options?: readonly QuestionOption[]
  readonly multiSelect?: boolean
}

/** One answer item, shaped like the host's ask_user_question answer. */
export interface QuestionAnswerItem {
  readonly id: string
  readonly selected: string[]
  readonly custom?: string
}

/** One question batch answer. */
export interface QuestionAnswer {
  readonly answers: readonly QuestionAnswerItem[]
}

/** Approval outcomes the host seam accepts from a claiming answerer. */
export type ApprovalOutcome = 'allowed-once' | 'rejected'

/** One approval waiting for a chat decision. */
export interface ApprovalView {
  readonly sessionId: string
  readonly toolName: string
  readonly callId?: string
  readonly reason?: string
  readonly workspace?: string
  readonly signal?: AbortSignal
}

/** One question batch waiting for a chat answer. */
export interface QuestionView {
  readonly sessionId: string
  readonly questions: readonly QuestionItem[]
  readonly callId?: string
  readonly workspace?: string
  readonly signal?: AbortSignal
}

