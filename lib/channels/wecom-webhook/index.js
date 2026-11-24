/** WeCom group bot: a webhook that only pushes. */
import { PushChannel } from '../../core/channel.js';
import { PushError } from '../../core/errors.js';
import { renderMarkdown, renderPlain } from '../../core/render.js';
/** WeCom caps markdown bodies well below this; keep pushes comfortably small. */
const MAX_BODY = 3800;
/** Group bot pushed through its webhook URL. */
export class WecomWebhookChannel extends PushChannel {
    id = 'wecom-webhook';
    capabilities = {
        inbound: false,
        actions: 'text',
        maxBodyChars: MAX_BODY,
        auth: 'none',
        targets: 'webhook',
    };
    #config;
    /** @param config - channel configuration. */
    constructor(config) {
        super();
        this.#config = {
            enabled: config.enabled ?? false,
            webhookUrl: config.webhookUrl ?? '',
            mentions: config.mentions ?? [],
            msgType: config.msgType ?? 'markdown',
        };
    }
    get settings() {
        return { enabled: this.#config.enabled, defaultTargets: [], interactive: false };
    }
    get configured() {
        return this.#config.webhookUrl.length > 0;
    }
    get status() {
        if (!this.#config.enabled)
            return { state: 'closed', targets: [], bound: false };
        if (!this.configured)
            return { state: 'error', error: 'webhook URL is empty', targets: [], bound: false };
        return { state: 'ready', targets: [], bound: true };
    }
    async open(runtime) {
        if (this.#config.enabled && !this.configured) {
            runtime.logger.warn('[push] wecom-webhook enabled without a webhook URL');
        }
    }
    async close() { }
    render(message) {
        if (this.#config.msgType === 'text')
            return renderPlain(message, MAX_BODY);
        return renderMarkdown(message, MAX_BODY);
    }
    async transmit(_target, message) {
        const text = this.#config.mentions.length > 0 && this.#config.msgType === 'text'
            ? `${message.text}\n${this.#config.mentions.map((user) => `<@${user}>`).join(' ')}`
            : message.text;
        const body = this.#config.msgType === 'text'
            ? { msgtype: 'text', text: { content: text, mentioned_list: [...this.#config.mentions] } }
            : { msgtype: 'markdown', markdown: { content: text } };
        const response = await this.runtime.http.send(this.#config.webhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            timeoutMs: 10_000,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok)
            throw new PushError('transport', `wecom webhook answered HTTP ${response.status}`);
        if (payload !== null && typeof payload.errcode === 'number' && payload.errcode !== 0) {
            throw new PushError('transport', `wecom webhook errcode ${payload.errcode}: ${payload.errmsg ?? ''}`);
        }
        return { ok: true };
    }
}
//# sourceMappingURL=index.js.map