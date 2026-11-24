/** How long a prompt stays answerable. */
const PENDING_TTL_MS = 60 * 60_000;
/** Reply vocabulary for approvals (case-insensitive). */
export const APPROVE_WORDS = new Set([
    'y', 'yes', 'ok', 'approve', '允许', '批准', '同意', '好', '好的', '是', '确认',
]);
/** Reply vocabulary for rejections (case-insensitive). */
export const REJECT_WORDS = new Set([
    'n', 'no', 'reject', 'deny', '拒绝', '不', '不用', '否', '取消',
]);
/**
 * Owns the prompts offered to chat.
 *
 * One prompt is outstanding at a time per session: it is queued, pushed to the
 * automatic recipient, and settled by the first reply that maps to it — or by the
 * DSH window, in which case the prompt is dropped and a late reply reports that.
 */
export class PromptBroker {
    #deps;
    #pending = [];
    /** @param deps - registry, waiters, clock, wording and session labels. */
    constructor(deps) {
        this.#deps = deps;
    }
    /** Number of answerable prompts (diagnostics). */
    get pendingCount() {
        return this.#pending.length;
    }
    /**
     * Offer one approval to the chat and wait for the decision.
     * @param view - the host's approval request.
     * @returns the chat decision, or null when another surface answered.
     */
    async onApproval(view) {
        let settle;
        const answered = new Promise((resolve) => { settle = resolve; });
        const entry = {
            kind: 'approval',
            sessionId: view.sessionId,
            callId: view.callId,
            toolName: view.toolName,
            reason: view.reason,
            workspace: view.workspace,
            createdAt: this.#deps.clock.now(),
            settle,
        };
        this.#track(entry);
        if (view.workspace !== undefined)
            this.#deps.state.setLabel(view.sessionId, view.workspace);
        const text = this.#deps.text();
        await this.#push({
            kind: 'prompt',
            title: text.approvalTitle(entry.workspace),
            body: [text.approvalBody(entry.toolName, entry.reason), '', text.approveHint].join('\n'),
            actions: [
                { id: 'approve', label: text.approveLabel, intent: 'accept' },
                { id: 'reject', label: text.rejectLabel, intent: 'reject' },
            ],
        });
        view.signal?.addEventListener('abort', () => {
            entry.settle(null);
            this.#pending = this.#pending.filter((item) => item !== entry);
        }, { once: true });
        return answered;
    }
    /**
     * Offer one question batch to the chat and wait for the answer.
     * @param view - the host's question request.
     * @returns the chat answer, or null when another surface answered.
     */
    async onQuestion(view) {
        let settle;
        const answered = new Promise((resolve) => { settle = resolve; });
        const entry = {
            kind: 'question',
            sessionId: view.sessionId,
            questions: view.questions,
            workspace: view.workspace,
            createdAt: this.#deps.clock.now(),
            settle,
        };
        this.#track(entry);
        if (view.workspace !== undefined)
            this.#deps.state.setLabel(view.sessionId, view.workspace);
        const text = this.#deps.text();
        const actions = view.questions.flatMap((question) => (question.options ?? []).slice(0, 6).map((option, at) => ({
            id: `${question.id}:${at + 1}`,
            label: option.label,
            intent: 'choice',
            value: String(at + 1),
        })));
        await this.#push({
            kind: 'prompt',
            title: text.questionTitle(entry.workspace),
            body: text.questionBody(entry.questions),
            ...(actions.length === 0 ? {} : { actions }),
        });
        view.signal?.addEventListener('abort', () => {
            entry.settle(null);
            this.#pending = this.#pending.filter((item) => item !== entry);
        }, { once: true });
        return answered;
    }
    /**
     * Another surface answered first: release the prompt so a late chat reply reports it.
     * @param kind - which prompt kind lost.
     * @param sessionId - the session it belonged to.
     * @param callId - the winning call id, when known.
     */
    drop(kind, sessionId, callId) {
        const dropped = this.#pending.filter((entry) => {
            if (entry.kind !== kind)
                return false;
            if (entry.sessionId !== sessionId)
                return false;
            if (entry.kind === 'approval' && callId !== undefined && entry.callId !== callId)
                return false;
            return true;
        });
        if (dropped.length === 0)
            return;
        this.#pending = this.#pending.filter((entry) => !dropped.includes(entry));
        for (const entry of dropped)
            entry.settle(null);
    }
    /**
     * Hold a send open until a reply arrives on one channel.
     * @param channel - the channel that will answer.
     * @param targets - conversations whose reply counts.
     * @param timeoutMs - longest wait.
     * @param signal - caller cancellation.
     * @returns the reply, or null on timeout/abort.
     */
    async awaitReply(channel, targets, timeoutMs, signal) {
        return this.#deps.waiters.open(channel, targets, timeoutMs, signal).promise;
    }
    /**
     * Settle the outstanding prompt with one reply.
     * @param inbound - the normalized message.
     * @param reply - the trimmed reply text.
     * @returns true when a prompt consumed the reply.
     */
    async answer(inbound, reply) {
        const pending = this.#pending[this.#pending.length - 1];
        if (pending === undefined)
            return false;
        if (pending.kind === 'approval') {
            await this.#answerApproval(inbound, pending, reply);
            return true;
        }
        await this.#answerQuestion(inbound, pending, reply);
        return true;
    }
    /** Release every pending prompt and wait. */
    dispose() {
        for (const entry of this.#pending)
            entry.settle(null);
        this.#pending = [];
    }
    #track(entry) {
        const cutoff = this.#deps.clock.now() - PENDING_TTL_MS;
        this.#pending = this.#pending.filter((item) => item.createdAt >= cutoff);
        this.#pending.push(entry);
    }
    async #push(message) {
        // One prompt, one recipient. The registry owns the automatic switch, so a
        // disabled profile sends nothing; the entry stays pending either way: the DSH
        // window can still answer it, and a late reply must not read as new input.
        await this.#deps.registry.sendPrompt(message);
    }
    async #receipt(inbound, text) {
        await this.#deps.registry.pushText(inbound.channel, inbound.target, text);
    }
    async #answerApproval(inbound, entry, reply) {
        const text = this.#deps.text();
        const word = reply.toLowerCase();
        const outcome = APPROVE_WORDS.has(word)
            ? 'allowed-once'
            : REJECT_WORDS.has(word) ? 'rejected' : null;
        if (outcome === null) {
            await this.#receipt(inbound, text.unknownApprovalReply(reply, entry.toolName));
            return;
        }
        this.#pending = this.#pending.filter((item) => item !== entry);
        entry.settle(outcome);
        const workspace = this.#deps.state.label(entry.sessionId);
        await this.#receipt(inbound, outcome === 'allowed-once'
            ? text.approveReceipt(workspace, entry.toolName)
            : text.rejectReceipt(workspace, entry.toolName));
    }
    async #answerQuestion(inbound, entry, reply) {
        const text = this.#deps.text();
        const answers = parseAnswers(entry.questions, reply);
        if (answers === null) {
            await this.#receipt(inbound, text.unknownQuestionReply(reply, text.questionBody(entry.questions)));
            return;
        }
        this.#pending = this.#pending.filter((item) => item !== entry);
        entry.settle({ answers });
        const summary = answers
            .map((answer) => answer.selected.join(' / ') || answer.custom || '')
            .filter((part) => part.length > 0)
            .join('; ');
        await this.#receipt(inbound, text.answerReceipt(summary));
    }
}
/**
 * Parse one reply into per-question answers.
 *
 * Multiple questions split on newlines or Chinese/Latin separators and map by
 * position; an optioned question accepts numbers (multi-select: several) or an
 * exact label; anything else becomes the custom answer.
 *
 * @param questions - the questions asked.
 * @param reply - the raw reply text.
 * @returns the answers, or null when nothing could be mapped.
 */
export function parseAnswers(questions, reply) {
    const segments = questions.length > 1
        ? reply.split(/[\n，；;,]/).map((part) => part.trim()).filter((part) => part.length > 0)
        : [reply];
    if (segments.length === 0)
        return null;
    const answers = [];
    const count = Math.min(segments.length, questions.length);
    for (let index = 0; index < count; index += 1) {
        const question = questions[index];
        const segment = segments[index];
        if (question === undefined || segment === undefined)
            continue;
        const options = question.options ?? [];
        if (options.length === 0) {
            answers.push({ id: question.id, selected: [], custom: segment });
            continue;
        }
        const picks = segment.split(/[\s、]+/).filter((part) => part.length > 0);
        if (picks.length > 0 && picks.every((pick) => /^\d+$/.test(pick))) {
            const labels = picks
                .map((pick) => options[Number(pick) - 1]?.label)
                .filter((label) => label !== undefined);
            if (labels.length === 0)
                return null;
            if (question.multiSelect !== true && labels.length > 1)
                return null;
            answers.push({ id: question.id, selected: question.multiSelect === true ? labels : [labels[0]] });
            continue;
        }
        const byLabel = options.find((option) => option.label === segment || option.label.toLowerCase() === segment.toLowerCase());
        if (byLabel !== undefined) {
            answers.push({ id: question.id, selected: [byLabel.label] });
            continue;
        }
        answers.push({ id: question.id, selected: [], custom: segment });
    }
    return answers.length === 0 ? null : answers;
}
//# sourceMappingURL=prompts.js.map