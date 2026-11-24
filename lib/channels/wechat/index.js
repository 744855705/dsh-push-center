/** WeChat ClawBot (iLink): QR login, long-poll inbox, reply-based pushes. */
import { PushChannel } from '../../core/channel.js';
import { PushError, errorMessage } from '../../core/errors.js';
import { createILinkWire, FALLBACK_BASE_URL } from './ilink.js';
import { WechatSession } from './session.js';
import { renderWechatText } from './render.js';
/** How long one QR stays valid. */
const LOGIN_TIMEOUT_MS = 5 * 60_000;
/** Login poll interval. */
const LOGIN_POLL_MS = 3_000;
/** QR refreshes tolerated before the attempt fails. */
const MAX_QR_REFRESHES = 3;
/** Backoff after an inbox transport failure. */
const POLL_BACKOFF_MS = 5_000;
/** Consecutive poll failures before the session counts as invalid. */
const POLL_FAILURE_LIMIT = 5;
/** Automatic renewals before asking for a fresh scan. */
const MAX_RELOGINS = 3;
/** Personal WeChat bot through Tencent iLink. */
export class WechatChannel extends PushChannel {
    id = 'wechat';
    capabilities = {
        inbound: true,
        actions: 'text',
        maxBodyChars: 2000,
        auth: 'qr',
        targets: 'chat',
    };
    #config;
    #wireOverride;
    #wire;
    #session;
    #state = 'closed';
    #error;
    #qr;
    #loop;
    #loginAbort;
    #pollFailures = 0;
    #reloginAttempts = 0;
    /**
     * @param config - channel configuration.
     * @param wire - optional transport override for tests.
     */
    constructor(config, wire) {
        super();
        this.#config = {
            enabled: config.enabled ?? false,
            defaultTargets: config.defaultTargets ?? [],
            interactive: config.interactive ?? true,
            sessionFile: config.sessionFile ?? '',
        };
        this.#wireOverride = wire;
    }
    get settings() {
        return {
            enabled: this.#config.enabled,
            defaultTargets: this.#config.defaultTargets,
            interactive: this.#config.interactive,
        };
    }
    get configured() {
        return true;
    }
    get status() {
        return {
            state: this.#state,
            bound: this.#session?.botToken !== undefined,
            ...(this.#error === undefined ? {} : { error: this.#error }),
            targets: this.#session?.targets ?? [],
            ...(this.#qr === undefined ? {} : { qr: this.#qr }),
        };
    }
    /** Current QR payload, when a login is pending. */
    get qr() {
        return this.#qr;
    }
    /** Forget the stored token and start a fresh QR login. */
    async relogin() {
        this.#loop?.abort();
        this.#loop = undefined;
        await this.#session?.setBotToken(undefined);
        this.#qr = undefined;
        this.#error = undefined;
        this.#state = 'opening';
        this.#beginLogin();
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
        this.#wire = this.#wireOverride ?? createILinkWire(runtime.http);
        const sessionFile = this.#config.sessionFile ?? '';
        const path = sessionFile.length > 0
            ? sessionFile
            : runtime.dataDir + '/wechat-session.json';
        const session = new WechatSession(path);
        await session.load();
        this.#session = session;
        this.#state = 'opening';
        if (session.botToken !== undefined) {
            this.#state = 'ready';
            this.#startInbox();
            return;
        }
        this.#beginLogin();
    }
    async close() {
        this.#loop?.abort();
        this.#loop = undefined;
        this.#loginAbort?.abort();
        this.#loginAbort = undefined;
        this.#qr = undefined;
        this.#state = 'closed';
    }
    render(message) {
        return renderWechatText(message);
    }
    async transmit(target, message) {
        const session = this.#session;
        const wire = this.#wire;
        if (session === undefined || wire === undefined)
            throw new PushError('unconfigured', 'wechat channel is not open');
        const token = session.botToken;
        if (token === undefined)
            throw new PushError('auth-failed', 'wechat bot is not logged in');
        if (target === null)
            throw new PushError('target-unknown', 'wechat needs an explicit recipient');
        const contextToken = session.contextOf(target);
        if (contextToken === undefined) {
            throw new PushError('target-unknown', 'this recipient must message the bot once before it can be pushed to');
        }
        try {
            await wire.sendText(token, session.baseUrl ?? FALLBACK_BASE_URL, target, message.text, contextToken);
        }
        catch (error) {
            if (error instanceof PushError && error.code === 'auth-failed')
                void this.#renewSession('send rejected');
            if (error instanceof PushError && error.code === 'target-unknown')
                await session.forgetContext(target);
            throw error;
        }
        return { ok: true };
    }
    async #login(signal) {
        const wire = this.#wire;
        const runtime = this.#runtimeOrUndefined;
        if (wire === undefined || runtime === undefined) {
            this.#fail('wechat channel is not ready');
            return;
        }
        for (let refresh = 0; refresh < MAX_QR_REFRESHES && !signal.aborted; refresh += 1) {
            let qr;
            try {
                qr = await wire.requestQr(signal);
            }
            catch (error) {
                if (signal.aborted)
                    return;
                this.#fail(errorMessage(error));
                return;
            }
            if (signal.aborted)
                return;
            this.#qr = { url: qr.url };
            const deadline = runtime.clock.now() + LOGIN_TIMEOUT_MS;
            while (runtime.clock.now() < deadline && !signal.aborted) {
                try {
                    const status = await wire.pollLogin(qr.qrcode, signal);
                    if (signal.aborted)
                        return;
                    if (status.status === 'confirmed' && status.botToken !== undefined) {
                        await this.#session?.setBotToken(status.botToken);
                        if (status.baseUrl !== undefined)
                            await this.#session?.setBaseUrl(status.baseUrl);
                        this.#qr = undefined;
                        this.#state = 'ready';
                        this.#error = undefined;
                        this.#reloginAttempts = 0;
                        this.#startInbox();
                        return;
                    }
                    if (status.status === 'expired')
                        break;
                }
                catch (error) {
                    if (signal.aborted)
                        return;
                    runtime.logger.warn('[push] wechat login poll failed: %s', errorMessage(error));
                }
                try {
                    await runtime.clock.sleep(LOGIN_POLL_MS, signal);
                }
                catch {
                    return;
                }
            }
            if (!signal.aborted)
                this.#qr = undefined;
        }
        if (!signal.aborted)
            this.#fail('wechat login expired, please scan again');
    }
    /** Drop an unusable session and start a fresh QR login, with a bounded retry. */
    async #renewSession(reason) {
        const runtime = this.#runtimeOrUndefined;
        this.#loop?.abort();
        this.#loop = undefined;
        this.#pollFailures = 0;
        this.#reloginAttempts += 1;
        if (this.#reloginAttempts > MAX_RELOGINS) {
            this.#fail('wechat session is invalid; scan the QR code again');
            return;
        }
        runtime?.logger.warn('[push] wechat session unavailable (%s); restarting login', reason);
        await this.#session?.setBotToken(undefined);
        this.#qr = undefined;
        this.#state = 'opening';
        this.#beginLogin();
    }
    /** Kick a login attempt off in the background; returns immediately. */
    #beginLogin() {
        const runtime = this.#runtimeOrUndefined;
        if (runtime === undefined) {
            this.#fail('wechat channel is not open');
            return;
        }
        this.#loginAbort?.abort();
        const abort = new AbortController();
        this.#loginAbort = abort;
        void this.#login(abort.signal).catch((error) => {
            runtime.logger.error('[push] wechat login failed: %s', errorMessage(error));
        });
    }
    #startInbox() {
        const runtime = this.#runtimeOrUndefined;
        const wire = this.#wire;
        const session = this.#session;
        if (runtime === undefined || wire === undefined || session === undefined)
            return;
        this.#loop?.abort();
        const loop = new AbortController();
        this.#loop = loop;
        void (async () => {
            while (!loop.signal.aborted) {
                const token = session.botToken;
                if (token === undefined)
                    return;
                try {
                    const updates = await wire.pollUpdates(token, session.baseUrl ?? FALLBACK_BASE_URL, session.updatesBuf ?? '', loop.signal);
                    this.#pollFailures = 0;
                    if (updates.cursor !== undefined)
                        await session.setUpdatesBuf(updates.cursor);
                    for (const update of updates.messages) {
                        await session.remember(update.user, update.contextToken, runtime.clock.now());
                        this.inbound(update.user, update.text);
                    }
                }
                catch (error) {
                    if (loop.signal.aborted)
                        return;
                    runtime.logger.warn('[push] wechat inbox poll failed: %s', errorMessage(error));
                    this.#pollFailures += 1;
                    const expired = error instanceof PushError && error.code === 'auth-failed';
                    if (expired || this.#pollFailures >= POLL_FAILURE_LIMIT) {
                        await this.#renewSession('inbox poll unavailable');
                        return;
                    }
                    try {
                        await runtime.clock.sleep(POLL_BACKOFF_MS);
                    }
                    catch {
                        return;
                    }
                }
            }
        })();
    }
    get #runtimeOrUndefined() {
        try {
            return this.runtime;
        }
        catch {
            return undefined;
        }
    }
    #fail(message) {
        this.#state = 'error';
        this.#error = message;
        this.#runtimeOrUndefined?.logger.error('[push] wechat channel failed: %s', message);
    }
}
//# sourceMappingURL=index.js.map