/** dsh-push-center: push DSH notifications to WeChat and WeCom. */
import { join } from 'node:path';
import { homedir } from 'node:os';
import { autoEnableOnFirstEntry, Config as ConfigSchema, defaultConfig, mergeConfig } from './config.js';
import { ChannelRegistry } from './core/registry.js';
import { Bindings } from './core/bindings.js';
import { Waiters } from './core/waiter.js';
import { Router } from './core/router.js';
import { createClock } from './clock.js';
import { createHttp } from './http.js';
import { createChannels, startChannels, stopChannels } from './services/channels.js';
import { createSettingsHandlers } from './services/settings.js';
import { Notifier } from './core/notifier.js';
import { chatText } from './core/chat-text.js';
import { JsonDocument } from './core/store.js';
import { DeliveryLog } from './core/delivery-log.js';
import { RendererQueue } from './core/renderer-queue.js';
import { AssociationFlow } from './channels/wecom-aibot/association.js';
import { HostSessions } from './hooks/host-sessions.js';
import { DshInteractions } from './hooks/interactions.js';
import { SessionEvents } from './hooks/session-events.js';
import { mountPushTool } from './services/push-tool.js';
import { installRpc } from './rpc.js';
export const name = 'push-center';
/** No hard host dependency: everything is soft-resolved so headless boots work. */
export const inject = [];
export const Config = ConfigSchema;
export { defaultConfig, mergeConfig };
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
    const registry = new ChannelRegistry({
        defaultChannelId: () => config.push.defaultChannel,
        autoChannelId: () => config.push.autoChannel,
    });
    const bindings = new Bindings();
    const waiters = new Waiters();
    const host = new HostSessions({ get: (service) => ctx.get(service), logger });
    const clock = createClock();
    const router = new Router({
        registry,
        bindings,
        waiters,
        host,
        clock,
        logger,
        text: () => chatText(config.messages.locale),
        hintEnabled: () => config.messages.hint,
        autoEnabled: () => config.enabled,
    });
    const notifier = new Notifier({
        registry,
        router,
        clock,
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
        clock,
        http,
        dataDir,
        onInbound: (message) => { void router.route(message); },
        logDelivery: (rows) => deliveries.record(rows),
    };
    let revision = 1;
    let channels = createChannels(config);
    for (const channel of channels)
        registry.add(channel);
    await startChannels(channels, runtime, logger);
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
        await stopChannels(channels);
        channels = createChannels(config);
        registry.reset(channels);
        await startChannels(channels, runtime, logger);
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
    const toolState = mountPushTool(ctx, {
        registry,
        router,
        logger,
        replyTimeoutMs: () => config.push.replyTimeoutMs,
    });
    const handlers = createSettingsHandlers({
        registry,
        deliveries,
        queue: rendererQueue,
        config: () => config,
        saveConfig: async (value) => applyConfig(autoEnableOnFirstEntry(config, mergeConfig(config, value))),
        enableChannel: async (id) => applyConfig({
            ...config,
            channels: { ...config.channels, [id]: { ...config.channels[id], enabled: true } },
        }),
        revision: () => revision,
        tool: toolState,
        associationStatus: () => association?.status ?? { phase: 'idle' },
        beginAssociation: () => associationFlow().begin(),
    });
    installRpc({
        inject: (names, callback) => ctx.inject(names, (scoped) => callback({ webServer: scoped.webServer })),
    }, handlers);
    ctx.effect(() => async () => {
        detachEvents();
        detachInteractions();
        router.dispose();
        await stopChannels(channels);
    }, 'push-center cleanup');
    logger.info('[push] ready with %d channel(s)', channels.length);
}
export default apply;
//# sourceMappingURL=index.js.map