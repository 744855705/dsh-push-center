/** dsh-push-center: push DSH notifications to WeChat and WeCom. */
import { join } from 'node:path';
import { homedir } from 'node:os';
import { autoEnableOnFirstEntry, Config as ConfigSchema, defaultConfig } from './config.js';
import { ChannelRegistry } from './core/registry.js';
import { Bindings } from './core/bindings.js';
import { Waiters } from './core/waiter.js';
import { Router } from './core/router.js';
import { Notifier } from './core/notifier.js';
import { chatText } from './core/chat-text.js';
import { JsonDocument } from './core/store.js';
import { DeliveryLog } from './core/delivery-log.js';
import { RendererQueue } from './core/renderer-queue.js';
import { WechatChannel } from './channels/wechat/index.js';
import { WecomAibotChannel } from './channels/wecom-aibot/index.js';
import { WecomWebhookChannel } from './channels/wecom-webhook/index.js';
import { SystemChannel } from './channels/system/index.js';
import { AssociationFlow } from './channels/wecom-aibot/association.js';
import { HostSessions } from './hooks/host-sessions.js';
import { DshInteractions } from './hooks/interactions.js';
import { SessionEvents } from './hooks/session-events.js';
import { createPushTool } from './tool.js';
import { installRpc } from './rpc.js';
export const name = 'push-center';
/** No hard host dependency: everything is soft-resolved so headless boots work. */
export const inject = [];
export const Config = ConfigSchema;
export { defaultConfig };
/** fetch-backed HTTP port with a per-request deadline. */
function createHttp() {
    return {
        async send(url, request = {}) {
            const timeout = request.timeoutMs ?? 15_000;
            const signal = request.signal === undefined
                ? AbortSignal.timeout(timeout)
                : AbortSignal.any([request.signal, AbortSignal.timeout(timeout)]);
            const response = await fetch(url, {
                method: request.method ?? 'GET',
                ...(request.headers === undefined ? {} : { headers: { ...request.headers } }),
                ...(request.body === undefined ? {} : { body: request.body }),
                signal,
            });
            return {
                ok: response.ok,
                status: response.status,
                text: () => response.text(),
                json: () => response.json(),
            };
        },
    };
}
/** Merge the patch config with the persisted settings page state. */
/**
 * Merge defaults, the profile patch and the settings-page state.
 *
 * Every group is merged on its own: a patch that omits a channel field must not
 * drop that field's default (a missing wsUrl used to crash the channel at start).
 * @param patch - configuration from the profile patch layer.
 * @param stored - configuration saved by the settings page.
 * @returns the effective configuration.
 */
export function mergeConfig(patch, stored) {
    const base = defaultConfig();
    const p = patch;
    const s = stored ?? {};
    const patchChannels = p.channels;
    const storedChannels = s.channels;
    return {
        enabled: s.enabled ?? p.enabled ?? base.enabled,
        titlePrefix: s.titlePrefix ?? p.titlePrefix ?? base.titlePrefix,
        mainAgentOnly: s.mainAgentOnly ?? p.mainAgentOnly ?? base.mainAgentOnly,
        events: { ...base.events, ...p.events, ...s.events },
        notify: { ...base.notify, ...p.notify, ...s.notify },
        push: { ...base.push, ...p.push, ...s.push },
        messages: { ...base.messages, ...p.messages, ...s.messages },
        system: {
            enabled: s.system?.enabled ?? p.system?.enabled ?? base.system.enabled,
            events: { ...base.system.events, ...p.system?.events, ...s.system?.events },
            backend: s.system?.backend ?? p.system?.backend ?? base.system.backend,
            sound: s.system?.sound ?? p.system?.sound ?? base.system.sound,
        },
        channels: {
            wechat: { ...base.channels.wechat, ...patchChannels?.wechat, ...storedChannels?.wechat },
            'wecom-aibot': { ...base.channels['wecom-aibot'], ...patchChannels?.['wecom-aibot'], ...storedChannels?.['wecom-aibot'] },
            'wecom-webhook': { ...base.channels['wecom-webhook'], ...patchChannels?.['wecom-webhook'], ...storedChannels?.['wecom-webhook'] },
        },
    };
}
/**
 * Create the channels in stable order.
 *
 * Chat channels exist only while enabled; the system notifier always exists so
 * the settings page can report its platform state, but it is never
 * auto-selectable and only the event switches route to it.
 */
function createChannels(config) {
    const welcome = chatText(config.messages.locale).welcome;
    const channels = [];
    if (config.channels.wechat.enabled)
        channels.push(new WechatChannel(config.channels.wechat));
    if (config.channels['wecom-aibot'].enabled)
        channels.push(new WecomAibotChannel(config.channels['wecom-aibot'], { welcomeText: welcome }));
    if (config.channels['wecom-webhook'].enabled)
        channels.push(new WecomWebhookChannel(config.channels['wecom-webhook']));
    channels.push(new SystemChannel(config.system));
    return channels;
}
/**
 * Mount the plugin.
 * @param rawCtx - the plugin's cordis context.
 * @param patch - configuration from the profile patch layer.
 */
export async function apply(rawCtx, patch) {
    const ctx = rawCtx;
    const logger = ctx.logger;
    const dataDir = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'push-center');
    const document = new JsonDocument(join(dataDir, 'config.json'), () => patch);
    let config = mergeConfig(patch, await document.read().then((value) => value));
    const deliveries = new DeliveryLog({ path: join(dataDir, 'deliveries.json') });
    await deliveries.load();
    // Only a raised notification or a live page touches this queue; a disabled
    // profile never builds an event.
    const rendererQueue = new RendererQueue();
    const http = createHttp();
    const registry = new ChannelRegistry({ defaultChannelId: () => config.push.defaultChannel });
    const bindings = new Bindings();
    const waiters = new Waiters();
    const host = new HostSessions({ get: (service) => ctx.get(service), logger });
    const router = new Router({
        registry,
        bindings,
        waiters,
        host,
        clock: { now: () => Date.now(), sleep: (ms, signal) => new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, ms);
                signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
            }) },
        logger,
        text: () => chatText(config.messages.locale),
        hintEnabled: () => config.messages.hint,
    });
    const notifier = new Notifier({
        registry,
        router,
        clock: { now: () => Date.now(), sleep: async () => { } },
        logger,
        policy: {
            enabled: () => config.enabled,
            events: () => config.events,
            titlePrefix: () => config.titlePrefix,
            hint: () => config.messages.hint,
            channels: () => config.notify.channels,
            text: () => chatText(config.messages.locale),
            system: () => ({
                enabled: config.system.enabled,
                events: config.system.events,
                backend: config.system.backend,
                platform: process.platform,
                enqueue: (event) => { rendererQueue.enqueue(event); },
                heartbeatAgeMs: () => rendererQueue.heartbeatAgeMs(),
            }),
        },
        noteDrop: (row) => { deliveries.record([row]); },
    });
    const runtime = {
        logger,
        clock: { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }) },
        http,
        dataDir,
        onInbound: (message) => { void router.route(message); },
        logDelivery: (rows) => deliveries.record(rows),
    };
    let revision = 1;
    let channels = createChannels(config);
    for (const channel of channels) {
        registry.add(channel);
        try {
            await channel.start(runtime);
        }
        catch (error) {
            logger.error('[push] channel %s failed to start: %s', channel.id, error instanceof Error ? error.message : String(error));
        }
    }
    const events = new SessionEvents({
        on: (event, listener) => ctx.on(event, ((session, payload) => listener(session, payload))),
        logger,
        notifier,
        mainAgentOnly: () => config.mainAgentOnly,
        locale: () => config.messages.locale,
    });
    const detachEvents = events.attach();
    const interactions = new DshInteractions({ on: (event, listener, options) => ctx.on(event, listener, options), logger }, router);
    const detachInteractions = interactions.attach();
    const applyConfig = async (next) => {
        config = next;
        revision += 1;
        await document.write(config);
        for (const channel of channels)
            await channel.close();
        channels = createChannels(config);
        registry.reset(channels);
        for (const channel of channels) {
            try {
                await channel.start(runtime);
            }
            catch (error) {
                logger.error('[push] channel %s failed to start: %s', channel.id, error instanceof Error ? error.message : String(error));
            }
        }
        return config;
    };
    let association;
    const associationFlow = () => {
        if (association !== undefined)
            return association;
        association = new AssociationFlow({
            http,
            logger,
            clock: runtime.clock,
            onAssociated: async ({ botId, secret }) => {
                const next = mergeConfig(config, { channels: { ...config.channels, 'wecom-aibot': { ...config.channels['wecom-aibot'], enabled: true, botId, secret } } });
                await applyConfig(next);
            },
        });
        return association;
    };
    // Registration failures are invisible from the outside, so record the outcome
    // and surface it on the settings page instead of discovering it by trial.
    let toolState = { registered: false, error: 'tools service is not available' };
    ctx.inject(['tools'], (scoped) => {
        const tools = scoped.tools;
        if (tools === undefined)
            return;
        try {
            tools.register(createPushTool({
                registry,
                router,
                logger,
                replyTimeoutMs: () => config.push.replyTimeoutMs,
            }));
            toolState = { registered: true };
        }
        catch (error) {
            toolState = { registered: false, error: error instanceof Error ? error.message : String(error) };
            logger.error('[push] push_message registration failed: %s', toolState.error);
        }
    });
    installRpc({
        inject: (names, callback) => ctx.inject(names, (scoped) => callback({ webServer: scoped.webServer })),
    }, {
        getConfig: () => config,
        setConfig: async (value) => applyConfig(autoEnableOnFirstEntry(config, mergeConfig(config, value))),
        getStatus: () => ({
            revision,
            defaultChannel: registry.defaultChannel()?.id ?? '',
            association: association?.status ?? { phase: 'idle' },
            tool: toolState,
            deliveries: deliveries.list(),
            system: {
                enabled: config.system.enabled,
                backend: config.system.backend,
                platform: process.platform,
                pageOpen: rendererQueue.pageOpen,
                hostSupported: process.platform !== 'darwin',
            },
            channels: registry.all().map((channel) => ({ id: channel.id, enabled: channel.enabled, configured: channel.configured, ...channel.status })),
        }),
        startWecomAibotQr: async () => {
            if (!config.channels['wecom-aibot'].enabled) {
                config = await applyConfig({
                    ...config,
                    channels: { ...config.channels, 'wecom-aibot': { ...config.channels['wecom-aibot'], enabled: true } },
                });
            }
            return associationFlow().begin();
        },
        system: {
            probe: () => ({
                enabled: config.system.enabled,
                backend: config.system.backend,
                platform: process.platform,
                hostSupported: process.platform !== 'darwin',
                pageOpen: rendererQueue.pageOpen,
                queued: rendererQueue.since(undefined).events.length,
            }),
            poll: (since) => {
                rendererQueue.touch();
                const drained = rendererQueue.since(since);
                return { events: drained.events, cursor: drained.cursor, pageOpen: true };
            },
            delivered: (input) => {
                deliveries.recordRenderer(input.shown, input.type);
                return { ok: true };
            },
            subscribe: (listener) => rendererQueue.subscribe(listener),
        },
        testChannel: async (channelId) => {
            const channel = registry.get(channelId);
            if (channel === undefined)
                return { ok: false, code: 'unknown-channel', state: 'missing', targets: 0 };
            const targets = channel.resolveRecipients();
            const state = channel.status.state;
            if (!channel.usable) {
                return {
                    ok: false,
                    code: 'not-ready',
                    state,
                    targets: targets.length,
                    ...(channel.status.error === undefined ? {} : { error: channel.status.error }),
                };
            }
            // A test push must survive being buried under event traffic, so it carries
            // a timestamp and a deliberately long body.
            const text = chatText(config.messages.locale);
            const at = new Date().toLocaleString(config.messages.locale === 'en' ? 'en-US' : 'zh-CN', { hour12: false });
            const report = await channel.send({ kind: 'text', title: text.testTitle(channelId), body: text.testBody(channelId, at) });
            const first = report.delivered[0];
            if (first !== undefined) {
                return {
                    ok: first.ok,
                    state,
                    targets: targets.length,
                    ...(first.code === undefined ? {} : { code: first.code }),
                    ...(first.message === undefined ? {} : { error: first.message }),
                };
            }
            const skip = report.skipped[0];
            return { ok: false, code: skip === undefined ? 'no-target' : skip.reason, state, targets: targets.length };
        },
        reloginWechat: async () => {
            const channel = registry.get('wechat');
            if (!config.channels.wechat.enabled || !(channel instanceof WechatChannel)) {
                // Binding is the act of enabling: one click turns the channel on and starts the scan.
                config = await applyConfig({
                    ...config,
                    channels: { ...config.channels, wechat: { ...config.channels.wechat, enabled: true } },
                });
                return registry.get('wechat')?.status ?? { state: 'opening', targets: [] };
            }
            await channel.relogin();
            return channel.status;
        },
    });
    ctx.effect(() => async () => {
        detachEvents();
        detachInteractions();
        router.dispose();
        for (const channel of channels)
            await channel.close();
    }, 'push-center cleanup');
    logger.info('[push] ready with %d channel(s)', channels.length);
}
export default apply;
//# sourceMappingURL=index.js.map