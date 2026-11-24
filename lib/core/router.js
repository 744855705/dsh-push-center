import { ChatState } from './chat-state.js';
import { ChatCommands } from './commands.js';
import { PromptBroker } from './prompts.js';
import { APPROVE_WORDS, REJECT_WORDS } from './prompts.js';
export { APPROVE_WORDS, REJECT_WORDS, parseAnswers } from './prompts.js';
/** Routes one inbound chat message to the part of the plugin that owns it. */
export class Router {
    #deps;
    #state = new ChatState();
    #prompts;
    #commands;
    /** @param deps - registry, stores and host session operations. */
    constructor(deps) {
        this.#deps = deps;
        this.#prompts = new PromptBroker({
            registry: deps.registry,
            waiters: deps.waiters,
            clock: deps.clock,
            text: deps.text,
            state: this.#state,
        });
        this.#commands = new ChatCommands({
            registry: deps.registry,
            host: deps.host,
            text: deps.text,
            state: this.#state,
        });
    }
    /** Number of answerable prompts (diagnostics). */
    get pendingCount() {
        return this.#prompts.pendingCount;
    }
    /** Remember the session a pushed notification belongs to. */
    noteNotification(channel, target, sessionId) {
        const now = this.#deps.clock.now();
        this.#deps.bindings.set(channel, target, sessionId, now);
        if (sessionId !== undefined) {
            this.#state.setCurrent(sessionId);
            this.#deps.bindings.noteSession(sessionId);
        }
    }
    /** Label a session by its workspace for receipts. */
    labelSession(sessionId, workspace) {
        if (workspace !== undefined)
            this.#state.setLabel(sessionId, workspace);
    }
    /** Offer one approval to the chat; null when another surface answered. */
    async onApproval(view) {
        return this.#prompts.onApproval(view);
    }
    /** Offer one question batch to the chat; null when another surface answered. */
    async onQuestion(view) {
        return this.#prompts.onQuestion(view);
    }
    /** Another surface answered first: release the prompt. */
    drop(kind, sessionId, callId) {
        this.#prompts.drop(kind, sessionId, callId);
    }
    /** Hold a send open until a reply arrives on one channel. */
    async awaitReply(channel, targets, timeoutMs, signal) {
        return this.#prompts.awaitReply(channel, targets, timeoutMs, signal);
    }
    /**
     * Route one inbound message.
     * @param inbound - the normalized message.
     */
    async route(inbound) {
        const channel = this.#deps.registry.get(inbound.channel);
        if (channel === undefined || !channel.interactive)
            return;
        const reply = inbound.text.trim();
        if (reply.length === 0)
            return;
        if (reply.startsWith('/')) {
            await this.#commands.run(inbound, reply);
            return;
        }
        if (this.#deps.waiters.settle(inbound.channel, inbound.target, reply, inbound.at))
            return;
        if (await this.#prompts.answer(inbound, reply))
            return;
        // A stray approve/reject must never become conversation input.
        const word = reply.toLowerCase();
        if (APPROVE_WORDS.has(word) || REJECT_WORDS.has(word)) {
            await this.#receipt(inbound, this.#deps.text().noPendingApproval);
            return;
        }
        await this.#continueConversation(inbound, reply);
    }
    /** Release every pending prompt and wait. */
    dispose() {
        this.#prompts.dispose();
        this.#deps.waiters.dispose();
    }
    /** Hand one free-form reply to the session the chat is talking to. */
    async #continueConversation(inbound, reply) {
        const text = this.#deps.text();
        const now = this.#deps.clock.now();
        const bound = this.#deps.bindings.get(inbound.channel, inbound.target, now);
        const sessionId = bound ?? this.#state.current() ?? this.#deps.bindings.lastSession;
        if (sessionId === undefined) {
            await this.#receipt(inbound, text.noSession);
            return;
        }
        const result = await this.#deps.host.prompt(sessionId, reply);
        if (result.ok) {
            this.#state.setCurrent(sessionId);
            this.#deps.bindings.set(inbound.channel, inbound.target, sessionId, now);
            await this.#receipt(inbound, text.sentTo(this.#state.label(sessionId)));
            return;
        }
        await this.#receipt(inbound, text.sendFailed(result.error ?? 'unknown error'));
    }
    async #receipt(inbound, text) {
        await this.#deps.registry.pushText(inbound.channel, inbound.target, text);
    }
}
//# sourceMappingURL=router.js.map