/** The Push settings page: a channel menu on the left, one topic on the right. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Config } from '../config.js'
import type { RpcCall, RpcResult } from './index.js'
import { Mark, type MarkName } from './icons.js'
import { permissionOf, requestPermission, showNotification } from './system-notify.js'

/** One channel row from the status endpoint. */
interface ChannelState {
  readonly id: string
  readonly state: string
  readonly bound?: boolean
  readonly error?: string
  readonly targets?: ReadonlyArray<{ readonly id: string; readonly lastSeenAt: number }>
  readonly qr?: { readonly url: string }
}

/** One recorded outbound attempt. */
interface DeliveryRow {
  readonly at: number
  readonly channel: string
  readonly target: string
  readonly ok: boolean
  readonly code?: string
  readonly message?: string
}

/** One self-check the person confirmed. */
interface SystemVerifyRow {
  readonly at: number
  readonly ok: boolean
  readonly backend: string
  readonly platform: string
  readonly app: string
}

/** System-notification state the host reports. */
interface SystemStatus {
  readonly enabled: boolean
  readonly backend: string
  readonly platform: string
  readonly pageOpen: boolean
  readonly hostSupported: boolean
  readonly verify: SystemVerifyRow | null
}

/** Status endpoint payload. */
interface StatusPayload {
  readonly defaultChannel: string
  readonly channels: ReadonlyArray<ChannelState>
  readonly deliveries?: ReadonlyArray<DeliveryRow>
  readonly system?: SystemStatus
  readonly association?: { readonly phase: string; readonly url?: string; readonly errorKey?: string; readonly completedAt?: number }
  readonly tool?: { readonly registered: boolean; readonly error?: string }
  readonly revision?: number
}

/** Props injected by the slot registration. */
export interface SettingsPageProps {
  readonly t: (key: string) => string
  readonly rpcCall: RpcCall
  readonly channel: string
  readonly endpoints: {
    readonly configGet: string
    readonly configSet: string
    readonly status: string
    readonly wechatRelogin: string
    readonly wecomAibotQrStart: string
    readonly channelTest: string
    readonly systemVerify: string
  }
}

/**
 * Menu entries: one topic per entry, icon above the label.
 *
 * The first two are fixed: every build has global settings and OS notifications.
 * Everything after them belongs to a chat channel, so a later release may add,
 * remove or reorder those without touching the fixed pair.
 */
const FIXED_SECTIONS = [
  { id: 'general', mark: 'settings', label: 'tabs.general' },
  { id: 'system', mark: 'bell', label: 'tabs.system' },
] as const

/** Chat-channel sections; version-dependent, appended after the fixed pair. */
const CHANNEL_SECTIONS = [
  { id: 'wechat', mark: 'wechat', label: 'tabs.wechat' },
  { id: 'wecom-aibot', mark: 'wecom', label: 'tabs.wecomAibot' },
  { id: 'wecom-webhook', mark: 'webhook', label: 'tabs.wecomWebhook' },
] as const

const SECTIONS = [...FIXED_SECTIONS, ...CHANNEL_SECTIONS] as const

/** Brand colours, so the two chat platforms are recognisable at a glance. */
const MARK_COLOR: Partial<Record<MarkName, string>> = { wechat: '#07C160', wecom: '#2B7BF2' }

/** Event switches, shared by the chat toggles and the system toggles. */
const EVENT_KEYS = ['conversationCompleted', 'conversationPaused', 'conversationFailed', 'authorizationRequired', 'confirmationRequired', 'todoProgress'] as const

type SectionId = (typeof SECTIONS)[number]['id']

const BORDER = '1px solid var(--dsw-alias-border-secondary, #e5e7eb)'

const S = {
  layout: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '2px 0', minWidth: 0 },
  nav: { display: 'flex', flexDirection: 'column' as const, gap: '4px', flex: '0 0 92px', width: '92px', position: 'sticky' as const, top: 0, alignSelf: 'flex-start', flexShrink: 0 },
  navItem: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '8px', border: '1px solid transparent', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '11px', lineHeight: 1.25, textAlign: 'center' as const },
  navItemActive: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '8px', border: BORDER, background: 'var(--dsw-alias-bg-secondary, rgba(127,127,127,0.08))', color: 'inherit', cursor: 'pointer', fontSize: '11px', lineHeight: 1.25, textAlign: 'center' as const, fontWeight: 600 },
  navIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 },
  content: { display: 'flex', flexDirection: 'column' as const, gap: '12px', flex: '1 1 auto', minWidth: 0, minHeight: 0, maxHeight: 'min(68vh, 600px)', overflowY: 'auto' as const, overscrollBehavior: 'contain' as const, paddingRight: '4px' },
  section: { border: BORDER, borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  header: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 10px' },
  heading: { margin: 0, fontSize: '15px', fontWeight: 600 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '6px 0' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '4px', padding: '6px 0' },
  label: { fontSize: '13px', opacity: 0.9 },
  hint: { fontSize: '12px', opacity: 0.55, marginTop: '2px', lineHeight: 1.45 },
  input: { width: '100%', boxSizing: 'border-box' as const, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border-secondary, #d4d4d8)', background: 'transparent', color: 'inherit', fontSize: '13px' },
  actions: { display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' as const, marginTop: '6px' },
  action: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: '4px', minWidth: '96px' },
  note: { fontSize: '12px', opacity: 0.6, minHeight: '16px', maxWidth: '100%', overflowWrap: 'anywhere' as const, lineHeight: 1.45 },
  button: { padding: '6px 14px', borderRadius: '7px', border: '1px solid var(--dsw-alias-border-secondary, #d4d4d8)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '13px' },
  primary: { padding: '6px 16px', borderRadius: '7px', border: '1px solid transparent', background: 'var(--dsw-alias-bg-accent, #2563eb)', color: '#fff', cursor: 'pointer', fontSize: '13px' },
  state: { fontSize: '12px', padding: '1px 8px', borderRadius: '999px', border: '1px solid currentColor', opacity: 0.8 },
  switch: { position: 'relative' as const, display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' as const, width: '36px', height: '20px', borderRadius: '999px', background: 'var(--dsw-alias-bg-secondary, rgba(127,127,127,0.32))', border: '1px solid var(--dsw-alias-border-secondary, #d4d4d8)', transition: 'background 120ms ease', boxSizing: 'border-box' as const },
  switchOn: { background: 'var(--dsw-alias-bg-accent, #2563eb)', borderColor: 'transparent' },
  switchFocus: { outline: '2px solid var(--dsw-alias-bg-accent, #2563eb)', outlineOffset: '2px' },
  switchInput: { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer', appearance: 'none' as const },
  knob: { position: 'absolute' as const, left: '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'transform 120ms ease', pointerEvents: 'none' as const },
  knobOn: { transform: 'translateX(16px)' },
  qr: { width: '150px', height: '150px', border: BORDER, borderRadius: '8px', marginTop: '8px' },
  footer: { display: 'flex', alignItems: 'flex-start', gap: '14px', paddingTop: '4px' },
} as const

/** Text input bound to one config path. */
function Field(props: { label: string; hint?: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label style={S.field}>
      <div style={S.label}>{props.label}</div>
      {props.hint === undefined ? null : <div style={S.hint}>{props.hint}</div>}
      <input style={S.input} value={props.value} placeholder={props.placeholder ?? ''} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  )
}

/** Switch bound to one boolean config path. */
function Toggle(props: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={S.row}>
      <span>
        <div style={S.label}>{props.label}</div>
        {props.hint === undefined ? null : <div style={S.hint}>{props.hint}</div>}
      </span>
      <span style={{ ...S.switch, ...(props.checked ? S.switchOn : {}), ...(focused ? S.switchFocus : {}) }}>
        {/* The real checkbox stays for keyboard and screen readers; the track is paint only. */}
        <input
          type="checkbox"
          style={S.switchInput}
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <span style={{ ...S.knob, ...(props.checked ? S.knobOn : {}) }} />
      </span>
    </label>
  )
}

/** Comma separated list field. */
function ListField(props: { label: string; hint?: string; value: readonly string[]; onChange: (value: string[]) => void }) {
  return (
    <Field
      label={props.label}
      {...(props.hint === undefined ? {} : { hint: props.hint })}
      value={props.value.join(', ')}
      onChange={(text) => props.onChange(text.split(',').map((part) => part.trim()).filter((part) => part.length > 0))}
    />
  )
}

/** The page component. */
export function SettingsPage(props: SettingsPageProps): JSX.Element {
  const { t, rpcCall, channel, endpoints } = props
  const [section, setSection] = useState<SectionId>('general')
  const [config, setConfig] = useState<Config | null>(null)
  const [draft, setDraft] = useState<Config | null>(null)
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => permissionOf())
  const [testSentAt, setTestSentAt] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [aibotQr, setAibotQr] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const draftRef = useRef<Config | null>(null)
  const configRef = useRef<Config | null>(null)
  const revisionRef = useRef<number>(-1)
  draftRef.current = draft
  configRef.current = config

  /** Adopt a config the host changed on its own (association, relogin). */
  const adoptServerConfig = useCallback((next: Config): void => {
    const before = configRef.current
    const editing = before !== null && draftRef.current !== null && JSON.stringify(before) !== JSON.stringify(draftRef.current)
    setConfig(next)
    if (!editing) {
      setDraft(next)
      return
    }
    setDraft((current) => current === null ? next : {
      ...current,
      channels: {
        ...current.channels,
        'wecom-aibot': {
          ...current.channels['wecom-aibot'],
          botId: next.channels['wecom-aibot'].botId,
          secret: next.channels['wecom-aibot'].secret,
        },
      },
    })
  }, [])

  const loadStatus = useCallback(async () => {
    const result = await rpcCall(channel, endpoints.status, {})
    if (!result.ok || result.value === undefined) return
    const payload = result.value as StatusPayload
    setStatus(payload)
    const revision = typeof payload.revision === 'number' ? payload.revision : 0
    if (revisionRef.current !== -1 && revision !== revisionRef.current) {
      revisionRef.current = revision
      const refreshed = await rpcCall(channel, endpoints.configGet, {})
      if (refreshed.ok && refreshed.value !== undefined) adoptServerConfig(refreshed.value as Config)
      return
    }
    revisionRef.current = revision
  }, [rpcCall, channel, endpoints.status, endpoints.configGet, adoptServerConfig])

  const load = useCallback(async () => {
    const result: RpcResult = await rpcCall(channel, endpoints.configGet, {})
    if (!result.ok) {
      setError(result.error?.message ?? t('loadFailed'))
      return
    }
    setConfig(result.value as Config)
    setDraft(result.value as Config)
    await loadStatus()
  }, [rpcCall, channel, endpoints.configGet, loadStatus, t])

  useEffect(() => { void load() }, [load])

  const wechatStatus = status?.channels.find((item) => item.id === 'wechat')
  const aibotStatus = status?.channels.find((item) => item.id === 'wecom-aibot')
  const webhookStatus = status?.channels.find((item) => item.id === 'wecom-webhook')
  const systemStatus = status?.channels.find((item) => item.id === 'system')
  const system = status?.system
  const qrUrl = wechatStatus?.qr?.url

  useEffect(() => {
    if (qrUrl === undefined) { setQrImage(null); return }
    let cancelled = false
    void QRCode.toDataURL(qrUrl, { width: 320, margin: 1 }).then((data) => { if (!cancelled) setQrImage(data) }).catch(() => { if (!cancelled) setQrImage(null) })
    return () => { cancelled = true }
  }, [qrUrl])

  const associationUrl = status?.association?.phase === 'pending' ? status.association.url : undefined

  useEffect(() => {
    if (associationUrl === undefined) { setAibotQr(null); return }
    let cancelled = false
    void QRCode.toDataURL(associationUrl, { width: 320, margin: 1 }).then((data) => { if (!cancelled) setAibotQr(data) }).catch(() => { if (!cancelled) setAibotQr(null) })
    return () => { cancelled = true }
  }, [associationUrl])

  // Always watch the host: association, relogin and any other surface can
  // change state while this page is open.
  useEffect(() => {
    const timer = setInterval(() => { void loadStatus() }, 3000)
    return () => { clearInterval(timer) }
  }, [loadStatus])

  const stateLabel = (value: string | undefined): string => value === undefined ? '' : t('state.' + value)

  const associationDone = status?.association?.phase === 'idle' && status.association.completedAt !== undefined

  const associationError = status?.association?.phase === 'error'
    ? t('wecomAibot.qr' + (status.association.errorKey === 'expired' ? 'Expired' : status.association.errorKey === 'timeout' ? 'Timeout' : 'Failed'))
    : null

  const dirty = useMemo(() => config !== null && draft !== null && JSON.stringify(config) !== JSON.stringify(draft), [config, draft])

  /** One action: the button, and its own line underneath for the outcome. */
  const action = (key: string, label: string, onClick: () => void, primary = false): JSX.Element => (
    <div style={S.action}>
      <button style={primary ? S.primary : S.button} onClick={onClick}>{label}</button>
      <div style={S.note}>{notes[key] ?? ''}</div>
    </div>
  )

  const say = (key: string, text: string): void => {
    setNotes((prev) => ({ ...prev, [key]: text }))
  }

  const save = async (): Promise<void> => {
    if (draft === null) return
    setSaving(true)
    setError(null)
    const result = await rpcCall(channel, endpoints.configSet, draft)
    setSaving(false)
    if (!result.ok) { say('save', result.error?.message ?? t('saveFailed')); return }
    setConfig(result.value as Config)
    setDraft(result.value as Config)
    setSaved(true)
    say('save', t('saved'))
    setTimeout(() => { setSaved(false) }, 2000)
    await loadStatus()
  }

  const wechatBound = wechatStatus?.bound === true

  const startWechatBind = async (): Promise<void> => {
    say('wechat.bind', t('loading'))
    const result = await rpcCall(channel, endpoints.wechatRelogin, {})
    if (!result.ok) { say('wechat.bind', result.error?.message ?? t('common.unknown')); return }
    say('wechat.bind', t('wechat.loginStarted'))
    await loadStatus()
  }

  const runTest = async (id: string): Promise<void> => {
    say('test.' + id, t('loading'))
    const result = await rpcCall(channel, endpoints.channelTest, { channel: id })
    if (!result.ok) { say('test.' + id, result.error?.message ?? t('channel.testFailed')); return }
    const value = result.value as { ok?: boolean; code?: string; error?: string }
    const text = value.ok === true
      ? t('channel.testOk')
      : value.code === 'no-target' ? t('channel.noTargetHint') : (value.error ?? value.code ?? t('channel.testFailed'))
    say('test.' + id, text)
  }

  const startAibotQr = async (): Promise<void> => {
    say('wecom-aibot.qr', t('loading'))
    const result = await rpcCall(channel, endpoints.wecomAibotQrStart, {})
    if (!result.ok) { say('wecom-aibot.qr', result.error?.message ?? t('common.unknown')); return }
    say('wecom-aibot.qr', t('wecomAibot.qrStarted'))
    await loadStatus()
  }

  if (error !== null && draft === null) return <div>{t('loadFailed')}: {error}</div>
  if (draft === null) return <div>{t('loading')}</div>

  const update = (next: Config): void => { setDraft(next) }
  const patchTop = <K extends keyof Config>(key: K, value: Config[K]): void => update({ ...draft, [key]: value })
  const patchChannel = (id: keyof Config['channels'], key: string, value: unknown): void => {
    const channels = { ...draft.channels, [id]: { ...draft.channels[id], [key]: value } }
    update({ ...draft, channels })
  }

  /** Header: title plus the live state of that channel. */
  const header = (title: string, state: string | undefined): JSX.Element => (
    <div style={S.header}>
      <h3 style={S.heading}>{title}</h3>
      <span style={S.state}>{stateLabel(state)}</span>
    </div>
  )

  const knownChats = (list: readonly { id: string }[] | undefined): string =>
    (list ?? []).map((target) => target.id).join(', ') || t('channel.noTargetHint')

  const targetsLine = (list: readonly { id: string }[] | undefined): JSX.Element => (
    <div style={S.hint}>{t('channel.knownChats')}: {knownChats(list)}</div>
  )

  const generalSection = (
    <>
      <section style={S.section}>
        <div style={S.header}><h3 style={S.heading}>{t('global.section')}</h3></div>
        <Toggle label={t('global.enabled')} hint={t('global.enabledHint')} checked={draft.enabled} onChange={(value) => patchTop('enabled', value)} />
        <Field label={t('global.titlePrefix')} hint={t('global.titlePrefixHint')} value={draft.titlePrefix} onChange={(value) => patchTop('titlePrefix', value)} />
        <Toggle label={t('global.mainAgentOnly')} hint={t('global.mainAgentOnlyHint')} checked={draft.mainAgentOnly} onChange={(value) => patchTop('mainAgentOnly', value)} />
      </section>
      <section style={S.section}>
        <div style={S.header}><h3 style={S.heading}>{t('defaultChannel.title')}</h3></div>
        <div style={S.hint}>{t('defaultChannel.hint')}</div>
        <label style={S.field}>
          <div style={S.label}>{t('defaultChannel.title')}</div>
          <select style={S.input} value={draft.push.defaultChannel} onChange={(event) => update({ ...draft, push: { ...draft.push, defaultChannel: event.target.value } })}>
            <option value="">{t('defaultChannel.auto')}</option>
            {draft.channels.wechat.enabled ? <option value="wechat">{t('wechat.title')}</option> : null}
            {draft.channels['wecom-aibot'].enabled ? <option value="wecom-aibot">{t('wecomAibot.title')}</option> : null}
            {draft.channels['wecom-webhook'].enabled ? <option value="wecom-webhook">{t('wecomWebhook.title')}</option> : null}
          </select>
        </label>
        <Field label={t('push.replyTimeout')} hint={t('push.replyTimeoutHint')} value={String(draft.push.replyTimeoutMs)} onChange={(value) => update({ ...draft, push: { ...draft.push, replyTimeoutMs: Number(value) || 120000 } })} />
      </section>
      <section style={S.section}>
        <div style={S.header}><h3 style={S.heading}>{t('deliveries.title')}</h3></div>
        <div style={S.hint}>{t('deliveries.hint')}</div>
        {(status?.deliveries ?? []).slice(0, 20).map((row, index) => (
          <div key={String(row.at) + '-' + String(index)} style={S.hint}>
            {new Date(row.at).toLocaleTimeString() + ' · ' + row.channel + (row.target.length === 0 ? '' : '/' + row.target) + ' · ' + (row.ok ? t('deliveries.ok') : t('deliveries.failed')) + (row.code === undefined ? '' : ' (' + row.code + ')')}
          </div>
        ))}
        {(status?.deliveries?.length ?? 0) === 0 ? <div style={S.hint}>{t('deliveries.empty')}</div> : null}
      </section>
      <section style={S.section}>
        <div style={S.header}><h3 style={S.heading}>{t('events.section')}</h3></div>
        <div style={S.hint}>{t('events.hint')}</div>
        {EVENT_KEYS.map((key) => (
          <Toggle key={key} label={t('events.' + key)} checked={draft.events[key]} onChange={(value) => update({ ...draft, events: { ...draft.events, [key]: value } })} />
        ))}
      </section>
      <section style={S.section}>
        <div style={S.header}><h3 style={S.heading}>{t('messages.section')}</h3></div>
        <label style={S.field}>
          <div style={S.label}>{t('messages.locale')}</div>
          <div style={S.hint}>{t('messages.localeHint')}</div>
          <select style={S.input} value={draft.messages.locale} onChange={(event) => update({ ...draft, messages: { ...draft.messages, locale: event.target.value === 'en' ? 'en' : 'zh' } })}>
            <option value="zh">{t('language.zh')}</option>
            <option value="en">{t('language.en')}</option>
          </select>
        </label>
        <Toggle label={t('messages.hint')} hint={t('messages.hintHint')} checked={draft.messages.hint} onChange={(value) => update({ ...draft, messages: { ...draft.messages, hint: value } })} />
      </section>
    </>
  )

  const wechatSection = (
    <section style={S.section}>
      {header(t('wechat.title'), wechatStatus?.state)}
      <Toggle label={t('wechat.enabled')} checked={draft.channels.wechat.enabled} onChange={(value) => patchChannel('wechat', 'enabled', value)} />
      <Toggle label={t('wechat.interactive')} hint={t('wechat.interactiveHint')} checked={draft.channels.wechat.interactive} onChange={(value) => patchChannel('wechat', 'interactive', value)} />
      <ListField label={t('wechat.defaultTargets')} hint={t('wechat.defaultTargetsHint')} value={draft.channels.wechat.defaultTargets} onChange={(value) => patchChannel('wechat', 'defaultTargets', value)} />
      <div style={S.actions}>
        {action('wechat.bind', wechatBound ? t('wechat.relogin') : t('wechat.bind'), () => { void startWechatBind() })}
        {action('test.wechat', t('channel.test'), () => { void runTest('wechat') })}
      </div>
      {qrImage === null ? null : (
        <div>
          <img src={qrImage} alt="QR" style={S.qr} />
          <div style={S.hint}>{t('wechat.scanHint')}</div>
        </div>
      )}
      {targetsLine(wechatStatus?.targets)}
    </section>
  )

  const aibotSection = (
    <section style={S.section}>
      {header(t('wecomAibot.title'), aibotStatus?.state)}
      <Toggle label={t('wecomAibot.enabled')} checked={draft.channels['wecom-aibot'].enabled} onChange={(value) => patchChannel('wecom-aibot', 'enabled', value)} />
      <Toggle label={t('wecomAibot.interactive')} hint={t('wecomAibot.interactiveHint')} checked={draft.channels['wecom-aibot'].interactive} onChange={(value) => patchChannel('wecom-aibot', 'interactive', value)} />
      <Field label={t('wecomAibot.botId')} value={draft.channels['wecom-aibot'].botId} onChange={(value) => patchChannel('wecom-aibot', 'botId', value)} />
      <Field label={t('wecomAibot.secret')} value={draft.channels['wecom-aibot'].secret} onChange={(value) => patchChannel('wecom-aibot', 'secret', value)} />
      <ListField label={t('wecomAibot.defaultTargets')} hint={t('wecomAibot.defaultTargetsHint')} value={draft.channels['wecom-aibot'].defaultTargets} onChange={(value) => patchChannel('wecom-aibot', 'defaultTargets', value)} />
      <div style={S.actions}>
        {action('wecom-aibot.qr', aibotStatus?.bound === true ? t('wecomAibot.qrRelink') : t('wecomAibot.qrStart'), () => { void startAibotQr() })}
        {action('test.wecom-aibot', t('channel.test'), () => { void runTest('wecom-aibot') })}
      </div>
      {associationError === null ? null : <div style={S.hint}>{associationError}</div>}
      {associationDone ? <div style={S.hint}>{t('wecomAibot.qrDone')}</div> : null}
      {aibotQr === null ? null : <img src={aibotQr} alt="QR" style={S.qr} />}
      {targetsLine(aibotStatus?.targets)}
    </section>
  )

  const webhookSection = (
    <section style={S.section}>
      {header(t('wecomWebhook.title'), webhookStatus?.state)}
      <Toggle label={t('wecomWebhook.enabled')} checked={draft.channels['wecom-webhook'].enabled} onChange={(value) => patchChannel('wecom-webhook', 'enabled', value)} />
      <Field label={t('wecomWebhook.webhookUrl')} hint={t('wecomWebhook.webhookUrlHint')} value={draft.channels['wecom-webhook'].webhookUrl} onChange={(value) => patchChannel('wecom-webhook', 'webhookUrl', value)} />
      <ListField label={t('wecomWebhook.mentions')} hint={t('wecomWebhook.mentionsHint')} value={draft.channels['wecom-webhook'].mentions} onChange={(value) => patchChannel('wecom-webhook', 'mentions', value)} />
      <div style={S.actions}>
        {action('test.wecom-webhook', t('channel.test'), () => { void runTest('wecom-webhook') })}
      </div>
    </section>
  )

  const verifyRow = (label: string, value: string): JSX.Element => (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <span style={S.hint}>{value}</span>
    </div>
  )

  const canNotify = permission === 'granted' && system?.enabled === true
  const pathLabel = system === undefined
    ? t('system.pathUnknown')
    : system.enabled !== true
      ? t('system.pathOff')
      : system.pageOpen
        ? t('system.pathRenderer')
        : system.hostSupported
          ? t('system.pathHost')
          : t('system.pathNone')
  const permissionLabel = permission === 'granted'
    ? t('system.permissionGranted')
    : permission === 'denied'
      ? t('system.permissionDenied')
      : permission === 'unsupported'
        ? t('system.permissionUnsupported')
        : t('system.permissionDefault')
  const verifyLabel = system?.verify === null || system?.verify === undefined
    ? t('system.neverVerified')
    : new Date(system.verify.at).toLocaleString() + ' · ' + (system.verify.ok ? t('system.verifyOk') : t('system.verifyFailed'))

  const askPermission = async (): Promise<void> => {
    const next = await requestPermission()
    setPermission(next)
    say('system.permission', next === 'granted' ? t('system.permissionGranted') : t('system.guidanceBrowser'))
  }

  const sendTestNotification = async (): Promise<void> => {
    if (permission !== 'granted') {
      const next = await requestPermission()
      setPermission(next)
      if (next !== 'granted') {
        say('system.test', t('system.guidanceBrowser'))
        return
      }
    }
    showNotification(t('system.testTitle'), t('system.testBody') + ' ' + new Date().toLocaleTimeString())
    setTestSentAt(Date.now())
    say('system.test', t('system.testSent'))
  }

  const confirmVerify = async (ok: boolean): Promise<void> => {
    const app = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent) ? 'desktop' : 'web'
    const platform = typeof navigator !== 'undefined' ? navigator.platform : 'unknown'
    const result = await rpcCall(channel, endpoints.systemVerify, { ok, app, platform })
    if (!result.ok) {
      say('system.verify', result.error?.message ?? t('loadFailed'))
      return
    }
    setTestSentAt(null)
    say('system.verify', ok ? t('system.verifyOk') : t('system.guidanceBrowser'))
  }

  const systemSection = (
    <section style={S.section}>
      {header(t('system.title'), systemStatus?.state)}
      <section style={S.section}>
        {verifyRow(t('system.canNotify'), canNotify ? t('system.notifyReady') : t('system.notifyBlocked'))}
        {verifyRow(t('system.permission'), permissionLabel)}
        {verifyRow(t('system.lastVerify'), verifyLabel)}
        {verifyRow(t('system.path'), pathLabel)}
        <div style={S.actions}>
          {action('system.permission', t('system.requestPermission'), () => { void askPermission() })}
          {action('system.test', t('system.testNotification'), () => { void sendTestNotification() }, true)}
        </div>
        {testSentAt === null ? null : (
          <div style={S.actions}>
            {action('system.verify', t('system.sawIt'), () => { void confirmVerify(true) }, true)}
            {action('system.didNotSee', t('system.didNotSee'), () => { void confirmVerify(false) })}
          </div>
        )}
      </section>
      <Toggle label={t('system.enabled')} hint={t('system.enabledHint')} checked={draft.system.enabled} onChange={(value) => update({ ...draft, system: { ...draft.system, enabled: value } })} />
      <div style={S.label}>{t('system.events')}</div>
      <div style={S.hint}>{t('system.eventsHint')}</div>
      {EVENT_KEYS.map((key) => (
        <Toggle
          key={key}
          label={t('events.' + key)}
          checked={draft.system.events[key]}
          onChange={(value) => update({ ...draft, system: { ...draft.system, events: { ...draft.system.events, [key]: value } } })}
        />
      ))}
      {systemStatus?.error === undefined ? null : <div style={S.hint}>{systemStatus.error}</div>}
    </section>
  )

  const body = section === 'general' ? generalSection
    : section === 'wechat' ? wechatSection
    : section === 'wecom-aibot' ? aibotSection
    : section === 'system' ? systemSection
    : webhookSection

  return (
    <div style={S.layout}>
      <nav style={S.nav} data-role="nav">
        {SECTIONS.map((item) => (
          <button key={item.id} style={section === item.id ? S.navItemActive : S.navItem} onClick={() => { setSection(item.id) }}>
            <span style={S.navIcon}><Mark name={item.mark} size={18} {...(MARK_COLOR[item.mark] === undefined ? {} : { color: MARK_COLOR[item.mark] })} /></span>
            <span>{t(item.label)}</span>
          </button>
        ))}
      </nav>
      <div style={S.content} data-role="content">
        {body}
        <div style={S.footer}>
          {action('save', saving ? t('saving') : t('save'), () => { void save() }, true)}
          <div style={{ ...S.note, minHeight: '16px' }}>{saved ? t('saved') : dirty ? t('dirty') : ''}</div>
          {error === null ? null : <div style={{ ...S.note, color: 'var(--dsw-alias-text-danger, #dc2626)' }}>{error}</div>}
        </div>
      </div>
    </div>
  )
}