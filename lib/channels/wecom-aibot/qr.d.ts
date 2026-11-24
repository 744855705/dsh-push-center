/** WeCom scan-to-associate client for the AI bot credentials.

 * Protocol (no auth): GET /ai/qc/generate?source=<name> returns a scode plus the
 * URL to render as a QR code; GET /ai/qc/query_result?scode=<scode> reports
 * success (with the issued botid/secret), expired, or pending. Only credentials
 * come out of this flow; the channel's WebSocket does the rest.
 */
import type { HttpClient } from '../../core/ports.js';
/** Default vendor host for the association endpoints. */
export declare const DEFAULT_ASSOCIATION_BASE = "https://work.weixin.qq.com";
/** One QR ticket. */
export interface QrTicket {
    readonly scode: string;
    /** URL the settings page renders as a QR code. */
    readonly authUrl: string;
}
/** One poll answer. */
export type QrPoll = {
    readonly status: 'pending';
} | {
    readonly status: 'expired';
} | {
    readonly status: 'success';
    readonly botId: string;
    readonly secret: string;
};
/** The transport surface the association flow uses. */
export interface QrClient {
    start(signal?: AbortSignal): Promise<QrTicket>;
    poll(scode: string, signal?: AbortSignal): Promise<QrPoll>;
}
/**
 * Build the association client.
 * @param http - injected HTTP port.
 * @param source - product label recorded by the vendor.
 * @param baseUrl - override for tests.
 * @returns the client.
 */
export declare function createQrClient(http: HttpClient, source?: string, baseUrl?: string): QrClient;
