/** Page-half system notifications: permission, live stream, polling fallback. */

import { EVENTS_PATH, RPC_CHANNEL, RPC_ENDPOINTS } from './rpc-contract.js'
import { readDrain } from '../core/renderer-queue.js'

/** How the page is currently receiving events. */
export type NotifyMode = 'off' | 'stream' | 'poll'

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
  readonly notify?: (title: string, body: string) => boolean
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

/**
 * Show one notification; formatting is the host's job.
 * @returns whether a notification was actually raised, so the ledger can record it.
 */
export function showNotification(title: string, body: string): boolean {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false
  // eslint-disable-next-line no-new -- the constructor both posts and owns the toast
  new Notification(title, { body })
  return true
}

function readCursor(): string {
  try {
    return globalThis.localStorage?.getItem(CURSOR_KEY) ?? ''
  } catch {
    return ''
  }
}

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
 * Nothing runs until the stored config says system notifications are enabled:
 * a disabled profile opens no stream, starts no timer and sends no request
 * beyond the one config read. When enabled, the page prefers the host's event
 * stream and falls back to polling if the stream cannot be held open.
 * @param options - RPC caller, state observer and notification override.
 * @returns the stop function.
 */
export function startSystemNotifications(options: SystemNotifyOptions): () => void {
  const notify = options.notify ?? showNotification
  let stopped = false
  let controller: AbortController | undefined
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let watchdog: ReturnType<typeof setTimeout> | undefined
  let mode: NotifyMode = 'off'
  let cursor = readCursor()

  const setMode = (next: NotifyMode, lastError?: string): void => {
    mode = next
    options.onChange?.({
      mode,
      permission: permissionOf(),
      ...(lastError === undefined ? {} : { lastError }),
    })
  }

  const handle = (event: RendererEvent): void => {
    if (typeof event?.id !== 'string' || event.id.length === 0) return
    if (event.id === cursor) return
    cursor = event.id
    writeCursor(event.id)
    const shown = notify(event.title, event.body)
    // The page owns the notification, so it also owns the delivery record: a
    // denied permission must be visible in the host ledger, not silently lost.
    void options.call(RPC_CHANNEL, RPC_ENDPOINTS.systemDelivered, {
      id: event.id,
      shown,
      ...(event.type === undefined ? {} : { type: event.type }),
    })
  }

  const drain = async (): Promise<void> => {
    const result = await options.call(RPC_CHANNEL, RPC_ENDPOINTS.systemPoll, { since: cursor })
    if (!result.ok) throw new Error(result.error?.message ?? 'poll failed')
    const drained = readDrain(result.value, cursor)
    // Handle first: handle() advances the cursor itself, so adopting the server
    // cursor up front would make a single-event response look already-seen.
    for (const event of drained.events) handle(event)
    if (drained.cursor !== cursor) {
      cursor = drained.cursor
      writeCursor(cursor)
    }
  }

  const startPolling = (reason?: string): void => {
    if (stopped) return
    setMode('poll', reason)
    const loop = async (): Promise<void> => {
      if (stopped) return
      try {
        await drain()
      } catch (error) {
        if (!stopped) options.onChange?.({ mode, permission: permissionOf(), lastError: error instanceof Error ? error.message : String(error) })
      }
      if (stopped) return
      pollTimer = setTimeout(() => { void loop() }, POLL_MS)
    }
    void loop()
  }

  const startStream = async (): Promise<void> => {
    if (stopped) return
    controller = new AbortController()
    const response = await fetch(EVENTS_PATH, {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    })
    if (!response.ok || response.body === null) throw new Error('stream rejected: HTTP ' + String(response.status))
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let opened = false
    const arm = (): void => {
      if (watchdog !== undefined) clearTimeout(watchdog)
      watchdog = setTimeout(() => { controller?.abort() }, STREAM_WATCHDOG_MS)
    }
    arm()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (!opened) {
        opened = true
        setMode('stream')
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
            handle(JSON.parse(line.slice(5).trim()) as RendererEvent)
          } catch {
            // A malformed frame is dropped; the stream itself stays usable.
          }
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
    // The stream ended without a stop request: keep following by polling.
    if (!stopped) startPolling('stream closed')
  }

  void (async () => {
    const config = await options.call(RPC_CHANNEL, RPC_ENDPOINTS.configGet, {})
    if (stopped) return
    if (!config.ok) {
      setMode('off', config.error?.message ?? 'config unavailable')
      return
    }
    const enabled = (config.value as { system?: { enabled?: boolean } } | undefined)?.system?.enabled === true
    if (!enabled) {
      setMode('off')
      return
    }
    if (permissionOf() === 'unsupported') {
      setMode('off', 'this page has no Notification API')
      return
    }
    try {
      await startStream()
    } catch (error) {
      if (!stopped) startPolling(error instanceof Error ? error.message : String(error))
    }
  })()

  return () => {
    stopped = true
    if (pollTimer !== undefined) clearTimeout(pollTimer)
    if (watchdog !== undefined) clearTimeout(watchdog)
    controller?.abort()
  }
}
