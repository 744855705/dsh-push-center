import { PushError, errorMessage } from '../../core/errors.js';
/** Default vendor host for the association endpoints. */
export const DEFAULT_ASSOCIATION_BASE = 'https://work.weixin.qq.com';
/** Read a string field, tolerating camelCase and snake_case. */
function pickString(record, keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0)
            return value.trim();
    }
    return '';
}
/**
 * Build the association client.
 * @param http - injected HTTP port.
 * @param source - product label recorded by the vendor.
 * @param baseUrl - override for tests.
 * @returns the client.
 */
export function createQrClient(http, source = 'dsh-push-center', baseUrl = DEFAULT_ASSOCIATION_BASE) {
    const get = async (path, query, signal, timeoutMs) => {
        const response = await http.send(baseUrl + path + '?' + query, {
            method: 'GET',
            timeoutMs,
            ...(signal === undefined ? {} : { signal }),
        });
        if (!response.ok)
            throw new PushError('transport', 'wecom association HTTP ' + response.status);
        const payload = await response.json();
        if (payload === null || typeof payload !== 'object')
            throw new PushError('transport', 'wecom association: empty response');
        const envelope = payload;
        const data = envelope.data;
        return data !== null && typeof data === 'object' ? data : envelope;
    };
    return {
        async start(signal) {
            const data = await get('/ai/qc/generate', 'source=' + encodeURIComponent(source), signal, 15_000);
            const scode = pickString(data, ['scode']);
            const authUrl = pickString(data, ['auth_url', 'authUrl']);
            if (scode.length === 0 || authUrl.length === 0) {
                throw new PushError('transport', 'wecom association returned no QR payload');
            }
            return { scode, authUrl };
        },
        async poll(scode, signal) {
            try {
                const data = await get('/ai/qc/query_result', 'scode=' + encodeURIComponent(scode), signal, 10_000);
                const status = pickString(data, ['status']).toLowerCase();
                if (status === 'success') {
                    const info = data.bot_info ?? data.botInfo;
                    const record = info !== null && typeof info === 'object' ? info : {};
                    const botId = pickString(record, ['botid', 'bot_id', 'botId']);
                    const secret = pickString(record, ['secret']);
                    return botId.length > 0 && secret.length > 0
                        ? { status: 'success', botId, secret }
                        : { status: 'pending' };
                }
                if (status === 'expired' || status === 'invalid')
                    return { status: 'expired' };
                return { status: 'pending' };
            }
            catch (error) {
                // A single transport blip must not end the wait.
                void errorMessage(error);
                return { status: 'pending' };
            }
        },
    };
}
//# sourceMappingURL=qr.js.map