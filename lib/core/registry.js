/** Channel lifecycle and default selection. No broadcast: one send names one channel. */
import { errorCode, errorMessage } from './errors.js';
/** Why one mounted-but-unusable channel took nothing. */
function unusableReason(channel) {
    if (!channel.enabled)
        return 'disabled';
    if (!channel.configured)
        return 'unconfigured';
    return 'not-ready';
}
/**
 * Owns the live channels and decides who receives a message.
 *
 * Selection is fixed and never fans out: an explicit channel wins; otherwise
 * the configured default; when the configured default exists but is unusable
 * the send reports why instead of silently switching to another channel. Only
 * an unconfigured default ('') resolves to the first usable channel.
 */
export class ChannelRegistry {
    #channels = [];
    #policy;
    /** @param policy - configuration accessor for the default channel. */
    constructor(policy) {
        this.#policy = policy;
    }
    /** Register one channel, preserving configuration order. */
    add(channel) {
        this.#channels.push(channel);
    }
    /** Replace the live channel set (config change). */
    reset(channels) {
        this.#channels = [...channels];
    }
    /** Every channel, in configuration order. */
    all() {
        return this.#channels;
    }
    /** One channel by id. */
    get(id) {
        return this.#channels.find((channel) => channel.id === id);
    }
    /** Channels that can send right now. */
    usable() {
        return this.#channels.filter((channel) => channel.usable);
    }
    /**
     * The channel a send uses when it names none.
     * A configured id is honoured even while unusable, so the send can report the
     * real reason instead of leaking to another channel; only '' falls back to the
     * first usable channel.
     * @returns the chosen channel, or undefined when nothing can take the message.
     */
    defaultChannel() {
        const configured = this.#policy.defaultChannelId();
        if (configured.length > 0)
            return this.get(configured);
        return this.usable().find((channel) => channel.autoSelectable);
    }
    /**
     * Send one message through exactly one channel.
     * @param message - the domain message.
     * @param options - explicit channel and target.
     * @returns what was delivered and why nothing was.
     */
    async send(message, options = {}) {
        const requested = options.channel === undefined ? undefined : this.get(options.channel);
        if (options.channel !== undefined && requested === undefined) {
            return { delivered: [], skipped: [{ channel: options.channel, reason: 'not-ready' }] };
        }
        const primary = requested ?? this.defaultChannel();
        if (primary?.usable === true) {
            return primary.send(message, options.target === undefined ? {} : { target: options.target });
        }
        return { delivered: [], skipped: [{ channel: primary?.id ?? options.channel ?? 'default', reason: primary === undefined ? 'not-ready' : unusableReason(primary) }] };
    }
    /**
     * Resolve the channel for one automatic message.
     *
     * One rule for every automatic path: the named channel, else the default, else
     * the first usable one — narrowed to channels that can take a reply when the
     * message is a prompt. Keeping it here means the notifier and the router never
     * grow their own pick-last-resort logic.
     * @param preferredId - the configured automatic channel ('' to follow the default).
     * @param needsInteractive - whether the message expects a reply.
     * @returns the channel to use, or undefined when nothing qualifies.
     */
    #resolve(preferredId, needsInteractive) {
        const accepts = (channel) => channel !== undefined && channel.usable && (!needsInteractive || channel.interactive);
        if (preferredId.length > 0 && accepts(this.get(preferredId)))
            return this.get(preferredId);
        const fallback = this.defaultChannel();
        if (accepts(fallback))
            return fallback;
        return this.usable().find((channel) => !needsInteractive || channel.interactive);
    }
    /**
     * Send one automatic message (event notifications).
     * @param message - the domain message.
     * @returns what was delivered and why nothing was.
     */
    async sendAutomatic(message) {
        return this.#sendResolved(message, this.#resolve(this.#policy.autoChannelId?.() ?? '', false));
    }
    /**
     * Send one prompt that expects a reply (approvals, questions).
     * @param message - the domain message.
     * @returns what was delivered and why nothing was.
     */
    async sendPrompt(message) {
        return this.#sendResolved(message, this.#resolve(this.#policy.autoChannelId?.() ?? '', true));
    }
    /** Send through an already resolved channel, reporting why nothing went out. */
    async #sendResolved(message, channel) {
        if (channel === undefined)
            return { delivered: [], skipped: [{ channel: 'default', reason: 'not-ready' }] };
        if (!channel.usable)
            return { delivered: [], skipped: [{ channel: channel.id, reason: unusableReason(channel) }] };
        return channel.send(message);
    }
    /**
     * Send a plain text to one exact conversation (receipts, command answers).
     * @param channelId - the channel to answer on.
     * @param target - the conversation.
     * @param text - the text.
     * @returns the delivery result, or a coded failure when the channel is gone.
     */
    async pushText(channelId, target, text) {
        const channel = this.get(channelId);
        if (channel === undefined) {
            return { ok: false, code: 'target-unknown', message: `channel ${channelId} is not registered`, channel: channelId, target };
        }
        try {
            const report = await channel.send({ kind: 'text', body: text }, { target });
            const first = report.delivered[0];
            if (first !== undefined)
                return first;
            return { ok: false, code: 'target-unknown', message: 'nothing was delivered', channel: channelId, target };
        }
        catch (error) {
            return { ok: false, code: errorCode(error), message: errorMessage(error), channel: channelId, target };
        }
    }
}
//# sourceMappingURL=registry.js.map