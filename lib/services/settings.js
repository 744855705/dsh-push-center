import { chatText } from '../core/chat-text.js';
import { WechatChannel } from '../channels/wechat/index.js';
import { hostNotifierAvailable } from '../core/platform.js';
/**
 * Create the settings handlers.
 * @param deps - the plugin surfaces these operations drive.
 * @returns the RPC handler set.
 */
export function createSettingsHandlers(deps) {
    const text = () => chatText(deps.config().messages.locale);
    return {
        getConfig: () => deps.config(),
        setConfig: async (value) => deps.saveConfig(value),
        getStatus: () => {
            const config = deps.config();
            const platform = process.platform;
            return {
                revision: deps.revision(),
                defaultChannel: deps.registry.defaultChannel()?.id ?? '',
                association: deps.associationStatus(),
                tool: deps.tool(),
                deliveries: deps.deliveries.list(),
                system: {
                    enabled: config.system.enabled,
                    backend: config.system.backend,
                    platform,
                    pageOpen: deps.queue.pageOpen,
                    hostSupported: hostNotifierAvailable(platform),
                },
                channels: deps.registry.all().map((channel) => ({
                    id: channel.id,
                    enabled: channel.enabled,
                    configured: channel.configured,
                    ...channel.status,
                })),
            };
        },
        startWecomAibotQr: async () => {
            if (!deps.config().channels['wecom-aibot'].enabled)
                await deps.enableChannel('wecom-aibot');
            return deps.beginAssociation();
        },
        system: {
            probe: () => {
                const config = deps.config();
                const platform = process.platform;
                return {
                    enabled: config.system.enabled,
                    backend: config.system.backend,
                    platform,
                    hostSupported: hostNotifierAvailable(platform),
                    pageOpen: deps.queue.pageOpen,
                    queued: deps.queue.pending(),
                };
            },
            poll: (since) => {
                deps.queue.touch();
                const claimed = deps.queue.claim(since);
                return { events: claimed.events, cursor: claimed.cursor, pageOpen: true };
            },
            touch: () => {
                deps.queue.touch();
            },
            delivered: (input) => {
                deps.deliveries.recordRenderer(input.shown, input.type);
                return { ok: true };
            },
            subscribe: (listener) => deps.queue.subscribe(listener),
        },
        testChannel: async (channelId) => {
            const channel = deps.registry.get(channelId);
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
            const locale = deps.config().messages.locale;
            const at = new Date().toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN', { hour12: false });
            const copy = text();
            const report = await channel.send({ kind: 'text', title: copy.testTitle(channelId), body: copy.testBody(channelId, at) });
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
            const channel = deps.registry.get('wechat');
            if (!deps.config().channels.wechat.enabled || !(channel instanceof WechatChannel)) {
                // Binding is the act of enabling: one click turns the channel on and starts the scan.
                await deps.enableChannel('wechat');
                return deps.registry.get('wechat')?.status ?? { state: 'opening', targets: [] };
            }
            await channel.relogin();
            return channel.status;
        },
    };
}
//# sourceMappingURL=settings.js.map