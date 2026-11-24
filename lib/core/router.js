/** Reply vocabulary for approvals (case-insensitive). */
export const APPROVE_WORDS = new Set([
    'y', 'yes', 'ok', 'approve', '允许', '批准', '同意', '好', '好的', '是', '确认',
]);
/** Reply vocabulary for rejections (case-insensitive). */
export const REJECT_WORDS = new Set([
    'n', 'no', 'reject', 'deny', '拒绝', '不', '不用', '否', '取消',
]);
const PENDING_TTL_MS = 60 * 60_000;
const MENU_PAGE_SIZE = 8;
/**
 * Routes one inbound chat message to the right action.
 *
 * The vocabulary is channel-independent: buttons on capable channels arrive as
 * the same text (Y/N, an option number, a /command), so this class never asks
 * which bot a message came from.
 */
export class Router {
    #deps;
    #pending = [];
    #lastSessionId;
    #labels = new Map();
    #menus = new Map();
    /** @param deps - registry, stores and host session operations. */
    constructor(deps) {
        this.#deps = deps;
    }
    /** Number of answerable prompts (diagnostics). */
    get pendingCount() {
        return this.#pending.length;
    }
    /** Remember the session a pushed notification belongs to. */
    noteNotification(channel, target, sessionId) {
        const now = this.#deps.clock.now();
        this.#deps.bindings.set(channel, target, sessionId, now);
        if (sessionId !== undefined) {
            this.#lastSessionId = sessionId;
            this.#deps.bindings.noteSession(sessionId);
        }
    }
    /** Label a session by its workspace for receipts. */
    labelSession(sessionId, workspace) {
        if (workspace !== undefined)
            this.#labels.set(sessionId, workspace);
    }
    // ── host prompts → chat ────────────────────────────────────────────────
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
            this.labelSession(view.sessionId, view.workspace);
        const text = this.#deps.text();
        await this.#pushToInteractive({
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
            this.labelSession(view.sessionId, view.workspace);
        const text = this.#deps.text();
        const actions = view.questions.flatMap((question) => (question.options ?? []).slice(0, 6).map((option, at) => ({
            id: `${question.id}:${at + 1}`,
            label: option.label,
            intent: 'choice',
            value: String(at + 1),
        })));
        await this.#pushToInteractive({
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
        const waiter = this.#deps.waiters.open(channel, targets, timeoutMs, signal);
        return waiter.promise;
    }
    // ── inbound ────────────────────────────────────────────────────────────
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
            await this.#command(inbound, reply);
            return;
        }
        if (this.#deps.waiters.settle(inbound.channel, inbound.target, reply, inbound.at))
            return;
        const pending = this.#pending[this.#pending.length - 1];
        if (pending?.kind === 'approval') {
            await this.#answerApproval(inbound, pending, reply);
            return;
        }
        if (pending?.kind === 'question') {
            await this.#answerQuestion(inbound, pending, reply);
            return;
        }
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
        for (const entry of this.#pending)
            entry.settle(null);
        this.#pending = [];
        this.#deps.waiters.dispose();
    }
    // ── internals ──────────────────────────────────────────────────────────
    #track(entry) {
        const cutoff = this.#deps.clock.now() - PENDING_TTL_MS;
        this.#pending = this.#pending.filter((item) => item.createdAt >= cutoff);
        this.#pending.push(entry);
    }
    async #pushToInteractive(message) {
        // One prompt, one recipient: the automatic channel when it can take a reply,
        // otherwise the default, otherwise the first channel that can.
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
        const workspace = this.#label(entry.sessionId);
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
    async #continueConversation(inbound, reply) {
        const text = this.#deps.text();
        const now = this.#deps.clock.now();
        const bound = this.#deps.bindings.get(inbound.channel, inbound.target, now);
        const sessionId = bound ?? this.#lastSessionId ?? this.#deps.bindings.lastSession;
        if (sessionId === undefined) {
            await this.#receipt(inbound, text.noSession);
            return;
        }
        const result = await this.#deps.host.prompt(sessionId, reply);
        if (result.ok) {
            this.#lastSessionId = sessionId;
            this.#deps.bindings.set(inbound.channel, inbound.target, sessionId, now);
            await this.#receipt(inbound, text.sentTo(this.#label(sessionId)));
            return;
        }
        await this.#receipt(inbound, text.sendFailed(result.error ?? 'unknown error'));
    }
    // ── commands ───────────────────────────────────────────────────────────
    async #command(inbound, reply) {
        const [rawToken = '', ...rest] = reply.slice(1).split(/\s+/);
        const token = (rawToken.split('@')[0] ?? '').toLowerCase();
        switch (token) {
            case 'sessions':
            case 'session':
                await this.#cmdSessions(inbound);
                return;
            case 'workspace':
            case 'workspaces':
                await this.#cmdWorkspaces(inbound);
                return;
            case 'current':
                await this.#cmdCurrent(inbound);
                return;
            case 'sel':
            case 'select':
                await this.#cmdSelect(inbound, rest);
                return;
            default:
                await this.#receipt(inbound, this.#deps.text().help);
        }
    }
    async #cmdSessions(inbound) {
        const text = this.#deps.text();
        const sessions = await this.#listSessions();
        if (sessions === null) {
            await this.#receipt(inbound, text.sessionListFailed);
            return;
        }
        if (sessions.length === 0) {
            await this.#receipt(inbound, text.noSessions);
            return;
        }
        this.#menus.set('s', sessions.map((session) => session.sessionId));
        const lines = sessions.map((session, at) => {
            const running = session.running ? ' ⏳' : '';
            const current = session.sessionId === this.#lastSessionId ? ' 👈' : '';
            return `${at + 1}. [${workspaceOf(session.cwd)}] ${titleOf(session)}${running}${current}`;
        });
        await this.#receipt(inbound, [text.sessionsIntro, '', ...lines].join('\n'));
    }
    async #cmdWorkspaces(inbound) {
        const text = this.#deps.text();
        const workspaces = await this.#deps.host.listWorkspaces();
        if (workspaces === null) {
            await this.#receipt(inbound, text.workspaceListFailed);
            return;
        }
        if (workspaces.length === 0) {
            await this.#receipt(inbound, text.noWorkspaces);
            return;
        }
        this.#menus.set('w', workspaces.map((workspace) => workspace.workspaceId));
        const lines = workspaces.map((workspace, at) => `${at + 1}. ${workspace.title} — ${workspace.path}`);
        await this.#receipt(inbound, [text.workspacesIntro, '', ...lines].join('\n'));
    }
    async #cmdCurrent(inbound) {
        const text = this.#deps.text();
        if (this.#lastSessionId === undefined) {
            await this.#receipt(inbound, text.currentNone);
            return;
        }
        await this.#receipt(inbound, text.currentLine(this.#label(this.#lastSessionId), this.#lastSessionId));
    }
    async #cmdSelect(inbound, args) {
        const text = this.#deps.text();
        const kind = (args[0] ?? '').toLowerCase();
        const ref = args[1] ?? '';
        if ((kind !== 's' && kind !== 'w') || ref.length === 0) {
            await this.#receipt(inbound, text.selectUsage);
            return;
        }
        const id = this.#alias(kind, ref);
        if (id === undefined) {
            await this.#receipt(inbound, text.selectInvalid);
            return;
        }
        if (kind === 's') {
            const label = workspaceOf((await this.#listSessions())?.find((session) => session.sessionId === id)?.cwd);
            this.#lastSessionId = id;
            this.#labels.set(id, label);
            await this.#receipt(inbound, text.switchedSession(`[${label}] `, id));
            return;
        }
        await this.#selectWorkspace(inbound, id);
    }
    async #selectWorkspace(inbound, workspaceId) {
        const text = this.#deps.text();
        const workspaces = await this.#deps.host.listWorkspaces();
        const workspace = workspaces?.find((item) => item.workspaceId === workspaceId);
        if (workspace === undefined) {
            await this.#receipt(inbound, text.workspaceListFailed);
            return;
        }
        const sessions = await this.#listSessions();
        const existing = sessions?.find((session) => session.cwd === workspace.path);
        if (existing !== undefined) {
            this.#lastSessionId = existing.sessionId;
            this.#labels.set(existing.sessionId, workspace.title);
            await this.#receipt(inbound, text.switchedWorkspace(workspace.title));
            return;
        }
        const created = await this.#deps.host.createSession(workspaceId);
        if (created.ok && created.sessionId !== undefined) {
            this.#lastSessionId = created.sessionId;
            this.#labels.set(created.sessionId, workspace.title);
            await this.#receipt(inbound, text.createdWorkspace(workspace.title));
            return;
        }
        await this.#receipt(inbound, text.createFailed(workspace.title, created.error ?? 'unknown error'));
    }
    async #listSessions() {
        const sessions = await this.#deps.host.listSessions();
        if (sessions === null)
            return null;
        return sessions.filter((session) => !session.blank && session.subagent !== true).slice(0, MENU_PAGE_SIZE);
    }
    #alias(kind, ref) {
        if (!/^\d+$/.test(ref))
            return ref;
        return this.#menus.get(kind)?.[Number(ref) - 1];
    }
    /** Workspace label of a session, or ''. */
    #label(sessionId) {
        const label = this.#labels.get(sessionId);
        return label === undefined ? '' : `[${label}] `;
    }
}
/** Display title of a session row. */
function titleOf(session) {
    const title = session.title?.trim();
    return title !== undefined && title.length > 0 ? title : `会话 ${session.sessionId.slice(0, 8)}…`;
}
/** Basename of a cwd. */
function workspaceOf(cwd) {
    if (cwd === undefined || cwd.length === 0)
        return '?';
    const parts = cwd.split('/').filter((part) => part.length > 0);
    return parts[parts.length - 1] ?? cwd;
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
//# sourceMappingURL=router.js.map