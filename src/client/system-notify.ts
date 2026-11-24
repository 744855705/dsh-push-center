/** Page-half system notifications: permission, live stream, polling fallback. */

import { EVENTS_PATH, RPC_CHANNEL, RPC_ENDPOINTS } from './rpc-contract.js'
import { readDrain, shouldHandle } from '../core/renderer-queue.js'

/** How the page is currently receiving events. */
export type NotifyMode = 'off' | 'denied' | 'stream' | 'poll'

/** What the page can tell the settings UI about itself. */
export interface NotifyState {
  readonly mode: NotifyMode
  readonly permission: NotificationPermission | 'unsupported'
  readonly lastError?: string
}

/** The RPC caller shape this module needs. */
export type SystemCall = (channel: string, endpoint: string, payload: unknown) => Promise<{
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: { readonly message?: string }
}>

/** Wiring for {@link startSystemNotifications}. */
export interface SystemNotifyOptions {
  readonly call: SystemCall
  /** Called whenever the mode or permission changes. */
  readonly onChange?: (state: NotifyState) => void
  /** Notification override for tests; returns whether it actually showed. */
  readonly notify?: (title: string, body: string, tag?: string) => boolean
}

/** Where the cursor survives a reload. */
const CURSOR_KEY = 'dsh-push-center:notified'

/** Background polling cadence when the stream is unavailable. */
const POLL_MS = 3000

/**
 * How long a silent stream may stay open before it is treated as dead.
 * Must exceed the host's 15s keep-alive comment, or the page would abort every
 * healthy stream before its first heartbeat and never use the live path.
 */
const STREAM_WATCHDOG_MS = 25_000

/** One event the host hands to the page. */
interface RendererEvent {
  readonly id: string
  readonly type?: string
  readonly title: string
  readonly body: string
}

/** Notification support on this page. */
export function permissionOf(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** Ask the browser for notification permission. */
export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

/** Timbre of the cue: bright, short, and deliberately hard to miss. */
const CUE = {
  /** Two rising tones read as "done" rather than "alert". */
  frequencies: [1568, 2093],
  /** Peak gain per tone; the master keeps the pair from clipping. */
  peak: 0.45,
  master: 0.6,
  /** Near-instant attack gives the "ding" its click. */
  attack: 0.005,
  decay: 0.18,
  /** Gap between the two tones. */
  gap: 0.12,
} as const

/**
 * The audible cue played with a notification.
 *
 * Browser notifications carry no sound setting beyond `silent`, and Chromium on
 * macOS delivers them without a sound at all, so the page synthesizes its own
 * two-tone ding. Every failure is silent: a blocked AudioContext must never
 * break the notification itself.
 */
export class NotificationCue {
  #enabled = true
  #context: AudioContext | undefined

  /** @param enabled - whether a cue plays with each notification. */
  constructor(enabled = true) {
    this.#enabled = enabled
  }

  /** Turn the cue on or off; the settings page owns this decision. */
  setEnabled(on: boolean): void {
    this.#enabled = on
  }

  /** Play the cue when enabled; does nothing otherwise. */
  play(): void {
    if (!this.#enabled) return
    try {
      const Ctor = typeof AudioContext === 'undefined' ? undefined : AudioContext
      if (Ctor === undefined) return
      this.#context ??= new Ctor()
      const audio = this.#context
      if (audio.state === 'suspended') void audio.resume()
      const start = audio.currentTime
      const master = audio.createGain()
      master.gain.value = CUE.master
      master.connect(audio.destination)
      for (const [index, frequency] of CUE.frequencies.entries()) {
        const at = start + index * CUE.gap
        const osc = audio.createOscillator()
        const gain = audio.createGain()
        osc.type = 'triangle'
        osc.frequency.value = frequency
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(CUE.peak, at + CUE.attack)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + CUE.attack + CUE.decay)
        osc.connect(gain)
        gain.connect(master)
        osc.start(at)
        osc.stop(at + CUE.attack + CUE.decay + 0.02)
      }
    } catch {
      // A blocked or unsupported audio context must not break notifications.
    }
  }
}

/** The page-wide cue; the settings page toggles it, notifications play it. */
export const cue = new NotificationCue()

/**
 * Turn the notification cue on or off.
 * @param on - whether a cue should play with each notification.
 */
export function setNotificationSound(on: boolean): void {
  cue.setEnabled(on)
}

/** Play the cue (kept as a function for callers that only know the module). */
export function playCue(): void {
  cue.play()
}

/**
 * Show one notification; formatting is the host's job.
 * @param title - notification title.
 * @param body - notification body.
 * @param tag - idempotency key: the OS replaces a notification with the same tag.
 * @returns whether a notification was actually raised, so the ledger can record it.
 */
export function showNotification(title: string, body: string, tag?: string): boolean {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false
  // eslint-disable-next-line no-new -- the constructor both posts and owns the toast
  new Notification(title, { body, silent: false, ...(tag === undefined ? {} : { tag }) })
  cue.play()
  return true
}

/** Read the persisted cursor; a blocked storage simply means per-load. */
function readCursor(): string {
  try {
    return globalThis.localStorage?.getItem(CURSOR_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Persist the cursor for the next load. */
function writeCursor(id: string): void {
  try {
    globalThis.localStorage?.setItem(CURSOR_KEY, id)
  } catch {
    // A blocked storage simply means the cursor is per-load; notifications still work.
  }
}

/**
 * Follow system-notification events for this page.
 *
 * One agent per page: a second start would double every notification. Nothing
 * runs until the stored config says system notifications are enabled — a
 * disabled profile opens no stream, starts no timer and sends no request beyond
 * the one config read. When enabled, the agent prefers the host's event stream
 * and falls back to polling if the stream cannot be held open.
 */
export class NotificationAgent {
  readonly #options: SystemNotifyOptions
  readonly #notify: (title: string, body: string, tag?: string) => boolean
  #stopped = false
  #controller: AbortController | undefined
  #pollTimer: ReturnType<typeof setTimeout> | undefined
  #watchdog: ReturnType<typeof setTimeout> | undefined
  #mode: NotifyMode = 'off'
  #cursor = readCursor()
  #wake: (() => void) | undefined

  /** @param options - RPC caller, state observer and notification override. */
  constructor(options: SystemNotifyOptions) {
    this.#options = options
    this.#notify = options.notify ?? showNotification
  }

  /** Start following events; returns the stop function. */
  start(): () => void {
    if (this.#stopped) return () => {}
    void this.#begin()
    return () => { this.stop() }
  }

  /** Stop following events and release every timer. */
  stop(): void {
    this.#stopped = true
    this.#wake = undefined
    if (this.#pollTimer !== undefined) clearTimeout(this.#pollTimer)
    if (this.#watchdog !== undefined) clearTimeout(this.#watchdog)
    this.#controller?.abort()
  }

  /** Retry now: the page may have gained permission since the agent gave up. */
  wake(): void {
    this.#wake?.()
  }

  /** Report the current mode to the settings page. */
  #setMode(next: NotifyMode, lastError?: string): void {
    this.#mode = next
    this.#options.onChange?.({
      mode: this.#mode,
      permission: permissionOf(),
      ...(lastError === undefined ? {} : { lastError }),
    })
  }

  /** Show one event at most once, and record what happened. */
  #handle(event: RendererEvent): void {
    if (typeof event?.id !== 'string') return
    // Re-read storage: a second tab may have handled this id already.
    if (!shouldHandle(event.id, this.#cursor, readCursor())) return
    this.#cursor = event.id
    writeCursor(event.id)
    const shown = this.#notify(event.title, event.body, event.id)
    // The page owns the notification, so it also owns the delivery record: a
    // denied permission must be visible in the host ledger, not silently lost.
    void this.#options.call(RPC_CHANNEL, RPC_ENDPOINTS.systemDelivered, {
      id: event.id,
      shown,
      ...(event.type === undefined ? {} : { type: event.type }),
    })
  }

  /** Take whatever the host has queued for this page. */
  async #drain(): Promise<void> {
    const result = await this.#options.call(RPC_CHANNEL, RPC_ENDPOINTS.systemPoll, { since: this.#cursor })
    if (!result.ok) throw new Error(result.error?.message ?? 'poll failed')
    const drained = readDrain(result.value, this.#cursor)
    // Handle first: #handle advances the cursor itself, so adopting the server
    // cursor up front would make a single-event response look already-seen.
    for (const event of drained.events) this.#handle(event)
    if (drained.cursor !== this.#cursor) {
      this.#cursor = drained.cursor
      writeCursor(this.#cursor)
    }
  }

  /** Fall back to polling; the loop stops with the agent. */
  #startPolling(reason?: string): void {
    if (this.#stopped) return
    this.#setMode('poll', reason)
    const loop = async (): Promise<void> => {
      if (this.#stopped) return
      try {
        await this.#drain()
      } catch (error) {
        if (!this.#stopped) {
          this.#options.onChange?.({
            mode: this.#mode,
            permission: permissionOf(),
            lastError: error instanceof Error ? error.message : String(error),
          })
        }
      }
      if (this.#stopped) return
      this.#pollTimer = setTimeout(() => { void loop() }, POLL_MS)
    }
    void loop()
  }

  /** Hold the live stream open, falling back to polling when it ends. */
  async #startStream(): Promise<void> {
    if (this.#stopped) return
    this.#controller = new AbortController()
    const response = await fetch(EVENTS_PATH, {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      signal: this.#controller.signal,
    })
    if (!response.ok || response.body === null) throw new Error('stream rejected: HTTP ' + String(response.status))
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let opened = false
    const arm = (): void => {
      if (this.#watchdog !== undefined) clearTimeout(this.#watchdog)
      this.#watchdog = setTimeout(() => { this.#controller?.abort() }, STREAM_WATCHDOG_MS)
    }
    arm()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (!opened) {
        opened = true
        this.#setMode('stream')
      }
      arm()
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue
          try {
            this.#handle(JSON.parse(line.slice(5).trim()) as RendererEvent)
          } catch {
            // A malformed frame is dropped; the stream itself stays usable.
          }
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
    // The stream ended without a stop request: keep following by polling.
    if (!this.#stopped) this.#startPolling('stream closed')
  }

  /** Read the config, decide whether to run, then pick a transport. */
  async #begin(): Promise<void> {
    const config = await this.#options.call(RPC_CHANNEL, RPC_ENDPOINTS.configGet, {})
    if (this.#stopped) return
    if (!config.ok) {
      this.#setMode('off', config.error?.message ?? 'config unavailable')
      return
    }
    const settings = (config.value as { system?: { enabled?: boolean; sound?: boolean } } | undefined)?.system
    setNotificationSound(settings?.sound !== false)
    if (settings?.enabled !== true) {
      this.#setMode('off')
      return
    }
    if (permissionOf() === 'unsupported') {
      this.#setMode('off', 'this page has no Notification API')
      return
    }
    if (permissionOf() !== 'granted') {
      // Taking an event would consume it for every page and then drop it.
      this.#setMode('denied')
      this.#wake = () => {
        if (this.#stopped || permissionOf() !== 'granted') return
        this.#wake = undefined
        void this.#begin()
      }
      return
    }
    try {
      await this.#startStream()
    } catch (error) {
      if (!this.#stopped) this.#startPolling(error instanceof Error ? error.message : String(error))
    }
  }
}

/** The page's single agent; a second start returns its stop function. */
let pageAgent: NotificationAgent | undefined

/**
 * Start following system notifications for this page.
 * @param options - RPC caller, state observer and notification override.
 * @returns the stop function.
 */
export function startSystemNotifications(options: SystemNotifyOptions): () => void {
  if (pageAgent === undefined) pageAgent = new NotificationAgent(options)
  return pageAgent.start()
}

/**
 * Tell the page agent that notification permission just changed.
 *
 * A page without permission deliberately takes no events, so the settings page
 * calls this once the person grants it.
 */
export function wakeSystemNotifications(): void {
  pageAgent?.wake()
}
