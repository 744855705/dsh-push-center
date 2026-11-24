/** The HTTP port the channels use. */
import type { HttpClient, HttpRequest, HttpResponse } from './core/ports.js'

/**
 * fetch-backed HTTP port with a per-request deadline.
 * @returns the port the channel runtime receives.
 */
export function createHttp(): HttpClient {
  return {
    async send(url: string, request: HttpRequest = {}): Promise<HttpResponse> {
      const timeout = request.timeoutMs ?? 15_000
      const signal = request.signal === undefined
        ? AbortSignal.timeout(timeout)
        : AbortSignal.any([request.signal, AbortSignal.timeout(timeout)])
      const response = await fetch(url, {
        method: request.method ?? 'GET',
        ...(request.headers === undefined ? {} : { headers: { ...request.headers } }),
        ...(request.body === undefined ? {} : { body: request.body }),
        signal,
      })
      return {
        ok: response.ok,
        status: response.status,
        text: () => response.text(),
        json: () => response.json(),
      }
    },
  }
}
