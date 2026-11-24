/** WeCom AI bot (智能机器人): WebSocket long connection, markdown pushes. */
import { WSClient } from '@wecom/aibot-node-sdk';
import { PushChannel } from '../../core/channel.js';
import { PushError, errorMessage } from '../../core/errors.js';
import { JsonDocument } from '../../core/store.js';
import { truncateAtLine } from '../../core/render.js';
import { buildPromptCard, cardEventOf, mapCardKey } from './cards.js';
import { markdownBlock } from '../../core/render.js';
/** WeCom markdown bodies cap well below this. */
const MAX_BODY = 4000;
/** 企业微信智能机器人 channel. */
export class WecomAibotChannel extends PushChannel {
    id = 'wecom-aibot';
    capabilities = {
        inbound: true,
        actions: 'buttons',
        maxBodyChars: MAX_BODY,
        auth: 'none',
        targets: 'chat',
    };
    #config;
    #client;
    #store;
    #targets = [];
    #state = 'closed';
    #error;
    #welcome;
    /**
     * @param config - channel configuration.
     * @param options - optional welcome text sent when a chat opens.
     */
    constructor(config, options) {
        super();
        // A persisted config may predate a field; never trust it to be complete.
        this.#config = {
            enabled: config.enabled ?? false,
            defaultTargets: config.defaultTargets ?? [],
            interactive: config.interactive ?? true,
            botId: config.botId ?? '',
            secret: config.secret ?? '',
            wsUrl: config.wsUrl ?? '',
        };
        this.#welcome = options?.welcomeText ?? 'Connected to DSH push.';
    }
    get settings() {
        return {
            enabled: this.#config.enabled,
            defaultTargets: this.#config.defaultTargets,
            interactive: this.#config.interactive,
        };
    }
    get configured() {
        return this.#config.botId.length > 0 && this.#config.secret.length > 0;
    }
    get status() {
        return {
            state: this.#state,
            bound: this.configured,
            ...(this.#error === undefined ? {} : { error: this.#error }),
            targets: this.#targets,
        };
    }
    async open(runtime) {
        try {
            await this.openUnsafe(runtime);
        }
        catch (error) {
            this.#state = 'error';
            this.#error = errorMessage(error);
            throw error;
        }
    }
    async openUnsafe(runtime) {
        if (!this.#config.enabled) {
            this.#state = 'closed';
            return;
        }
        if (!this.configured) {
            this.#state = 'error';
            this.#error = 'Bot ID and secret are required';
            return;
        }
        const store = new JsonDocument(runtime.dataDir + '/wecom-aibot.json', () => ({ targets: [] }));
        this.#store = store;
        this.#targets = (await store.read()).targets ?? [];
        const client = new WSClient({
            botId: this.#config.botId,
            secret: this.#config.secret,
            logger: runtime.logger,
            ...(this.#config.wsUrl.length > 0 ? { wsUrl: this.#config.wsUrl } : {}),
        });
        client.on('authenticated', () => {
            this.#state = 'ready';
            this.#error = undefined;
        });
        client.on('error', (error) => {
            this.#state = 'error';
            this.#error = error.message;
        });
        client.on('disconnected', () => {
            this.#state = 'opening';
        });
        client.on('message', (frame) => {
            void this.#onMessage(frame, runtime);
        });
        client.on('event.enter_chat', (frame) => {
            void this.#onEnterChat(frame, runtime);
        });
        client.on('event.template_card_event', (frame) => {
            void this.#onCardEvent(frame, runtime);
        });
        this.#client = client;
        this.#state = 'opening';
        client.connect();
    }
    async close() {
        this.#client?.disconnect();
        this.#client = undefined;
        this.#state = 'closed';
    }
    render(message) {
        const text = truncateAtLine(markdownBlock(message.title, message.body), MAX_BODY);
        if (message.actions === undefined || message.actions.length === 0)
            return { text };
        return {
            text,
            actions: message.actions,
            card: {
                ...(message.title === undefined ? {} : { title: message.title }),
                body: message.body,
                actions: message.actions,
            },
        };
    }
    async transmit(target, message) {
        const client = this.#client;
        if (client === undefined)
            throw new PushError('unconfigured', 'wecom-aibot channel is not open');
        if (target === null)
            throw new PushError('target-unknown', 'wecom-aibot needs an explicit chat id');
        if (message.card !== undefined) {
            const card = buildPromptCard(message.card, 'push-' + Date.now());
            await client.sendMessage(target, { msgtype: 'template_card', template_card: card });
            return { ok: true };
        }
        const body = { msgtype: 'markdown', markdown: { content: message.text } };
        await client.sendMessage(target, body);
        return { ok: true };
    }
    async #onMessage(frame, runtime) {
        const body = frame.body;
        const target = targetFromEvent(body);
        if (target === undefined)
            return;
        const text = extractText(body ?? {});
        if (text === undefined || text.length === 0)
            return;
        await this.#remember(target, runtime);
        this.inbound(target, text);
    }
    /** Learn the chat as soon as someone opens it, so pushes work without a message. */
    /** A button was tapped: translate it into the shared reply vocabulary. */
    async #onCardEvent(frame, runtime) {
        const body = frame.body;
        const card = cardEventOf(body);
        const reply = mapCardKey(card?.eventKey);
        const target = targetFromEvent(body);
        if (reply === null) {
            runtime.logger.warn('[push] wecom-aibot card event with unknown key: %s', String(card?.eventKey));
            return;
        }
        if (target === undefined) {
            runtime.logger.warn('[push] wecom-aibot card event without a chat id');
            return;
        }
        // Route first: the reader decision must never wait on a card refresh.
        this.inbound(target, reply);
        void this.#ackCard(frame, runtime, card?.taskId);
    }
    /** Best-effort card refresh inside WeCom's 5 second window. */
    async #ackCard(frame, runtime, taskId) {
        const client = this.#client;
        if (client === undefined)
            return;
        try {
            // Bound the refresh: a missing ack must never hold a pending decision.
            await Promise.race([
                client.updateTemplateCard(frame, {
                    card_type: 'button_interaction',
                    main_title: { title: this.#welcome.slice(0, 20) },
                    sub_title_text: 'handled',
                    button_list: [],
                    ...(taskId === undefined ? {} : { task_id: taskId }),
                }),
                new Promise((resolve) => setTimeout(resolve, 4000)),
            ]);
        }
        catch (error) {
            runtime.logger.warn('[push] wecom-aibot card ack failed: %s', errorMessage(error));
        }
    }
    async #onEnterChat(frame, runtime) {
        const body = frame.body;
        const target = targetFromEvent(body);
        if (target === undefined)
            return;
        await this.#remember(target, runtime);
        const client = this.#client;
        if (client === undefined)
            return;
        try {
            await client.replyWelcome(frame, { msgtype: 'text', text: { content: this.#welcome } });
        }
        catch (error) {
            runtime.logger.warn('[push] wecom-aibot welcome failed: %s', errorMessage(error));
        }
    }
    async #remember(target, runtime) {
        if (this.#targets.some((item) => item.id === target))
            return;
        this.#targets = [{ id: target, lastSeenAt: runtime.clock.now() }, ...this.#targets].slice(0, 64);
        try {
            await this.#store?.write({ targets: this.#targets });
        }
        catch (error) {
            runtime.logger.warn('[push] could not persist wecom-aibot chats: %s', errorMessage(error));
        }
    }
}
/**
 * The chat a message or event belongs to: the group chatid, else the sender userid.
 * @param body - the frame body.
 * @returns the target id, or undefined when the body carries none.
 */
export function targetFromEvent(body) {
    if (body === undefined)
        return undefined;
    const chatid = typeof body.chatid === 'string' && body.chatid.length > 0 ? body.chatid : undefined;
    const from = body.from;
    const userid = typeof from?.userid === 'string' && from.userid.length > 0 ? from.userid : undefined;
    return chatid ?? userid;
}
/** Text carried by a text or voice message body. */
function extractText(body) {
    const text = body.text;
    if (typeof text?.content === 'string')
        return text.content;
    const voice = body.voice;
    if (typeof voice?.content === 'string')
        return voice.content;
    return undefined;
}
//# sourceMappingURL=index.js.map