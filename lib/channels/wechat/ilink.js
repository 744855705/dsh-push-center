/** WeChat iLink wire client.
 *
 * The protocol lives here and nowhere else: request headers, the long-poll cursor,
 * the message envelope and the response shapes. Everything above this file works
 * with the typed surface below.
 */
import { randomBytes } from 'node:crypto';
import { PushError } from '../../core/errors.js';
const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';
/** The server holds getupdates for roughly 35s; the request budget must exceed it. */
export const LONG_POLL_TIMEOUT_MS = 40_000;
/** The bot session's base URL when the login answer does not carry one. */
export const FALLBACK_BASE_URL = DEFAULT_BASE_URL;
/** iLink bot type used by the ClawBot flow. */
const BOT_TYPE = '3';
/** X-WECHAT-UIN: base64 of a random uint32, the way the ClawBot client sends it. */
function randomWechatUin() {
    return Buffer.from(String(randomBytes(4).readUInt32BE(0)), 'utf8').toString('base64');
}
/** Headers shared by every iLink call. */
function headers(token) {
    const value = {
        'content-type': 'application/json',
        AuthorizationType: 'ilink_bot_token',
        'X-WECHAT-UIN': randomWechatUin(),
    };
    if (token !== undefined && token.length > 0)
        value.Authorization = `Bearer ${token}`;
    return value;
}
/** First defined value among candidate keys. */
function pick(record, keys) {
    for (const key of keys) {
        const value = record[key];
        if (value !== undefined)
            return value;
    }
    return undefined;
}
/**
 * Throw unless the service reported success.
 *
 * iLink reports failures as ret (bot calls) or errcode (shared gateway);
 * -14 is an expired session and -2 a dead context token.
 */
function assertOk(payload, what) {
    if (payload === null || typeof payload !== 'object') {
        throw new PushError('transport', `iLink ${what}: empty response`);
    }
    const record = payload;
    const raw = record.ret ?? record.errcode;
    const code = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0;
    if (Number.isFinite(code) && code !== 0) {
        const message = typeof record.errmsg === 'string' ? record.errmsg : `code ${String(raw)}`;
        const kind = code === -14 ? 'auth-failed' : code === -2 ? 'target-unknown' : 'transport';
        throw new PushError(kind, `iLink ${what}: ${message}`);
    }
    return record;
}
/** Text carried by one message, preferring plain text and falling back to a voice transcript. */
function textOf(msg) {
    const items = Array.isArray(msg.item_list) ? msg.item_list : [];
    for (const entry of items) {
        if (entry === null || typeof entry !== 'object')
            continue;
        const item = entry;
        if (item.type === 1) {
            const text = item.text_item?.text;
            if (typeof text === 'string')
                return text;
        }
        if (item.type === 3) {
            const text = item.voice_item?.text;
            if (typeof text === 'string')
                return `[voice] ${text}`;
        }
    }
    return '';
}
/**
 * Build the wire client.
 * @param http - injected HTTP port.
 * @param loginBaseUrl - where the QR login lives.
 * @returns the transport surface.
 */
export function createILinkWire(http, loginBaseUrl = DEFAULT_BASE_URL) {
    const request = async (baseUrl, path, init) => {
        const response = await http.send(`${baseUrl}${path}`, {
            method: init.method,
            headers: headers(init.token),
            ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
            timeoutMs: init.timeoutMs,
            ...(init.signal === undefined ? {} : { signal: init.signal }),
        });
        if (!response.ok)
            throw new PushError('transport', `iLink ${init.method} ${path}: HTTP ${response.status}`);
        return assertOk(await response.json(), path);
    };
    return {
        async requestQr(signal) {
            const payload = await request(loginBaseUrl, `/ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`, {
                method: 'GET',
                timeoutMs: 15_000,
                ...(signal === undefined ? {} : { signal }),
            });
            const qrcode = pick(payload, ['qrcode', 'qrcode_id']);
            const url = pick(payload, ['qrcode_img_content', 'qrcode_url', 'url']);
            if (typeof qrcode !== 'string' || qrcode.length === 0)
                throw new PushError('transport', 'iLink get_bot_qrcode: no qrcode');
            if (typeof url !== 'string' || url.length === 0)
                throw new PushError('transport', 'iLink get_bot_qrcode: no QR url');
            return { qrcode, url };
        },
        async pollLogin(qrcode, signal) {
            const payload = await request(loginBaseUrl, `/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`, {
                method: 'GET',
                timeoutMs: 15_000,
                ...(signal === undefined ? {} : { signal }),
            });
            const status = pick(payload, ['status']);
            const token = pick(payload, ['bot_token', 'token']);
            const baseUrl = pick(payload, ['baseurl', 'base_url']);
            return {
                status: typeof status === 'string' ? status : 'pending',
                ...(typeof token === 'string' && token.length > 0 ? { botToken: token } : {}),
                ...(typeof baseUrl === 'string' && baseUrl.length > 0 ? { baseUrl } : {}),
            };
        },
        async pollUpdates(botToken, baseUrl, cursor, signal) {
            const payload = await request(baseUrl, '/ilink/bot/getupdates', {
                method: 'POST',
                body: { get_updates_buf: cursor },
                token: botToken,
                timeoutMs: LONG_POLL_TIMEOUT_MS,
                ...(signal === undefined ? {} : { signal }),
            });
            const messages = [];
            const raw = Array.isArray(payload.msgs) ? payload.msgs : [];
            for (const entry of raw) {
                if (entry === null || typeof entry !== 'object')
                    continue;
                const msg = entry;
                // Only inbound user messages carry a usable context token.
                if (msg.message_type !== 1)
                    continue;
                const user = typeof msg.from_user_id === 'string' ? msg.from_user_id : undefined;
                if (user === undefined || user.length === 0)
                    continue;
                const contextToken = typeof msg.context_token === 'string' ? msg.context_token : undefined;
                messages.push({ user, text: textOf(msg), ...(contextToken === undefined ? {} : { contextToken }) });
            }
            const next = typeof payload.get_updates_buf === 'string' ? payload.get_updates_buf : undefined;
            return { messages, ...(next === undefined ? {} : { cursor: next }) };
        },
        async sendText(botToken, baseUrl, toUser, text, contextToken, signal) {
            await request(baseUrl, '/ilink/bot/sendmessage', {
                method: 'POST',
                token: botToken,
                timeoutMs: 15_000,
                body: {
                    msg: {
                        from_user_id: '',
                        to_user_id: toUser,
                        client_id: `dsh-push-${Date.now()}`,
                        message_type: 2,
                        message_state: 2,
                        context_token: contextToken,
                        item_list: [{ type: 1, text_item: { text } }],
                    },
                },
                ...(signal === undefined ? {} : { signal }),
            });
        },
    };
}
//# sourceMappingURL=ilink.js.map