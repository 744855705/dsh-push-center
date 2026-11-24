/** push_message: the agent-facing proactive push. */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { errorMessage } from './core/errors.js';
/** One row per delivery, dropping internal fields. */
function rowsOf(report) {
    return report.delivered.map((delivery) => ({
        channel: delivery.channel,
        target: delivery.target ?? '',
        ok: delivery.ok,
        ...(delivery.code === undefined ? {} : { code: delivery.code }),
        ...(delivery.message === undefined ? {} : { message: delivery.message }),
    }));
}
/**
 * Build the tool definition.
 * @param deps - registry, router and configuration.
 * @returns the registry-ready definition.
 */
export function createPushTool(deps) {
    return defineTool({
        name: 'push_message',
        description: [
            'Send a proactive message to a configured chat channel (WeChat, WeCom AI bot, WeCom group bot).',
            'Omit channel to use the configured default; it falls back to broadcasting when that channel is unavailable.',
            'Set expectReply to wait for the reader reply as the tool result; it requires a single target.',
        ].join(' '),
        parameters: {
            text: { type: 'string', required: true, description: 'Message body to send.' },
            channel: { type: 'string', description: 'Channel id: wechat, wecom-aibot, or wecom-webhook. Omit for the default.' },
            target: { type: 'string', description: 'Conversation id; omit to use the channel default, recent conversations, then every known one.' },
            title: { type: 'string', description: 'Optional heading rendered above the body.' },
            markdown: { type: 'boolean', description: 'Render as markdown where the channel supports it. Defaults to true.' },
            expectReply: { type: 'boolean', description: 'Wait for one reply and return it. Requires exactly one resolved target.' },
            options: {
                type: 'array',
                description: 'Quick replies shown with expectReply.',
                items: { type: 'string' },
            },
            timeoutMs: { type: 'number', description: 'Longest reply wait in milliseconds; capped by configuration.' },
        },
        output: {
            // defineTool compiles this shorthand into JSON Schema (required: true per
            // property becomes a required array at the object level).
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    status: { type: 'string', required: true, enum: ['sent', 'replied', 'timeout', 'failed'] },
                    delivered: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                channel: { type: 'string', required: true },
                                target: { type: 'string', required: true },
                                ok: { type: 'boolean', required: true },
                                code: { type: 'string' },
                                message: { type: 'string' },
                            },
                        },
                    },
                    skipped: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                channel: { type: 'string', required: true },
                                reason: { type: 'string', required: true },
                            },
                        },
                    },
                    reply: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            text: { type: 'string', required: true },
                            target: { type: 'string', required: true },
                            at: { type: 'number', required: true },
                        },
                    },
                    error: { type: 'string' },
                },
            },
            render: (_args, value) => {
                const result = value;
                const lines = [];
                if (result.status === 'replied' && result.reply !== undefined) {
                    lines.push('replied by ' + result.reply.target + ': ' + result.reply.text);
                }
                else if (result.status === 'timeout') {
                    lines.push('no reply before the timeout');
                }
                else if (result.status === 'failed') {
                    lines.push('push failed: ' + (result.error ?? 'unknown error'));
                }
                else {
                    for (const row of result.delivered) {
                        if (!row.ok)
                            continue;
                        lines.push('sent to ' + row.channel + (row.target.length === 0 ? '' : '/' + row.target));
                    }
                }
                for (const row of result.delivered) {
                    if (!row.ok)
                        lines.push('failed on ' + row.channel + (row.code === undefined ? '' : ' (' + row.code + ')') + ': ' + (row.message ?? ''));
                }
                for (const row of result.skipped)
                    lines.push('skipped ' + row.channel + ': ' + row.reason);
                return [{ type: 'text', text: lines.join('\n') }];
            },
        },
        async execute(rawArgs, exec) {
            const args = rawArgs;
            const text = args.text.trim();
            if (text.length === 0) {
                return { status: 'failed', delivered: [], skipped: [], error: 'text must not be empty' };
            }
            if (args.channel === 'system') {
                return {
                    status: 'failed',
                    delivered: [],
                    skipped: [],
                    error: 'the system notifier is event-driven only: tick the events in the settings page instead of addressing it here',
                };
            }
            const channel = args.channel === undefined ? deps.registry.defaultChannel() : deps.registry.get(args.channel);
            if (channel === undefined) {
                return { status: 'failed', delivered: [], skipped: [], error: 'no usable channel: ' + String(args.channel ?? 'default') };
            }
            const targets = channel.resolveRecipients(args.target);
            if (args.expectReply === true && (targets.length !== 1 || args.channel === undefined)) {
                return { status: 'failed', delivered: [], skipped: [], error: 'expectReply needs exactly one resolved target and an explicit channel' };
            }
            const body = args.options === undefined || args.options.length === 0
                ? text
                : text + '\n\n' + args.options.map((option, index) => (index + 1) + '. ' + option).join('\n');
            const actions = args.options?.map((option, index) => ({
                id: 'option-' + (index + 1),
                label: option,
                intent: 'choice',
                value: String(index + 1),
            }));
            const report = await deps.registry.send({ kind: args.expectReply === true ? 'reply-request' : 'text', body: args.title === undefined ? body : body, ...(args.title === undefined ? {} : { title: args.title }), ...(actions === undefined ? {} : { actions }) }, args.channel === undefined ? {} : { channel: args.channel, ...(args.target === undefined ? {} : { target: args.target }) });
            const sessionId = exec.agent?.session?.id;
            for (const delivery of report.delivered) {
                if (delivery.ok)
                    deps.router.noteNotification(delivery.channel, delivery.target ?? '', sessionId);
            }
            const delivered = rowsOf(report);
            const skipped = report.skipped.map((row) => ({ channel: row.channel, reason: row.reason }));
            const base = { delivered, skipped };
            if (delivered.every((row) => !row.ok)) {
                return { status: 'failed', ...base, error: 'every target failed' };
            }
            if (args.expectReply !== true)
                return { status: 'sent', ...base };
            const cap = deps.replyTimeoutMs();
            const timeout = Math.min(args.timeoutMs ?? cap, 300_000);
            try {
                const reply = await deps.router.awaitReply(channel.id, targets, timeout, exec.signal);
                if (reply === null)
                    return { status: 'timeout', ...base };
                return { status: 'replied', ...base, reply: { text: reply.text, target: reply.target, at: reply.at } };
            }
            catch (error) {
                deps.logger.warn('[push] reply wait failed: %s', errorMessage(error));
                return { status: 'timeout', ...base };
            }
        },
    });
}
//# sourceMappingURL=tool.js.map