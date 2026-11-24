import type { HttpClient } from '../../core/ports.js';
/** The server holds getupdates for roughly 35s; the request budget must exceed it. */
export declare const LONG_POLL_TIMEOUT_MS = 40000;
/** The bot session's base URL when the login answer does not carry one. */
export declare const FALLBACK_BASE_URL = "https://ilinkai.weixin.qq.com";
/** One QR login attempt. */
export interface ILinkQr {
    readonly qrcode: string;
    /** URL the settings page renders as a QR code. */
    readonly url: string;
}
/** One login poll answer. */
export interface ILinkLoginStatus {
    readonly status: string;
    readonly botToken?: string;
    /** Base URL the server assigned to this bot session. */
    readonly baseUrl?: string;
}
/** One inbound message. */
export interface ILinkInbound {
    readonly user: string;
    readonly text: string;
    readonly contextToken?: string;
}
/** One long-poll answer: new messages plus the cursor to continue from. */
export interface ILinkUpdates {
    readonly messages: readonly ILinkInbound[];
    readonly cursor?: string;
}
/** The transport surface the channel uses. */
export interface ILinkWire {
    requestQr(signal?: AbortSignal): Promise<ILinkQr>;
    pollLogin(qrcode: string, signal?: AbortSignal): Promise<ILinkLoginStatus>;
    pollUpdates(botToken: string, baseUrl: string, cursor: string, signal?: AbortSignal): Promise<ILinkUpdates>;
    sendText(botToken: string, baseUrl: string, toUser: string, text: string, contextToken: string, signal?: AbortSignal): Promise<void>;
}
/**
 * Build the wire client.
 * @param http - injected HTTP port.
 * @param loginBaseUrl - where the QR login lives.
 * @returns the transport surface.
 */
export declare function createILinkWire(http: HttpClient, loginBaseUrl?: string): ILinkWire;
