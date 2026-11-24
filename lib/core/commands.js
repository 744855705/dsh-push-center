/** How many rows a menu prints. */
const MENU_PAGE_SIZE = 8;
/**
 * Handles the slash commands a person types in chat.
 *
 * Every command answers with one receipt; selection commands also move the chat
 * to another session or workspace, which is the only state they keep here.
 */
export class ChatCommands {
    #deps;
    #menus = new Map();
    /** @param deps - registry, host session operations, wording and labels. */
    constructor(deps) {
        this.#deps = deps;
    }
    /**
     * Run one slash command.
     * @param inbound - the normalized message.
     * @param reply - the text, starting with '/'.
     */
    async run(inbound, reply) {
        const [rawToken = '', ...rest] = reply.slice(1).split(/\s+/);
        const token = (rawToken.split('@')[0] ?? '').toLowerCase();
        switch (token) {
            case 'sessions':
            case 'session':
                await this.#sessions(inbound);
                return;
            case 'workspace':
            case 'workspaces':
                await this.#workspaces(inbound);
                return;
            case 'current':
                await this.#current(inbound);
                return;
            case 'sel':
            case 'select':
                await this.#select(inbound, rest);
                return;
            default:
                await this.#receipt(inbound, this.#deps.text().help);
        }
    }
    async #sessions(inbound) {
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
            const current = session.sessionId === this.#deps.state.current() ? ' 👈' : '';
            return `${at + 1}. [${workspaceOf(session.cwd)}] ${titleOf(session)}${running}${current}`;
        });
        await this.#receipt(inbound, [text.sessionsIntro, '', ...lines].join('\n'));
    }
    async #workspaces(inbound) {
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
    async #current(inbound) {
        const text = this.#deps.text();
        const current = this.#deps.state.current();
        if (current === undefined) {
            await this.#receipt(inbound, text.currentNone);
            return;
        }
        await this.#receipt(inbound, text.currentLine(this.#deps.state.label(current), current));
    }
    async #select(inbound, args) {
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
            this.#deps.state.setCurrent(id);
            this.#deps.state.setLabel(id, label);
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
            this.#deps.state.setCurrent(existing.sessionId);
            this.#deps.state.setLabel(existing.sessionId, workspace.title);
            await this.#receipt(inbound, text.switchedWorkspace(workspace.title));
            return;
        }
        const created = await this.#deps.host.createSession(workspaceId);
        if (created.ok && created.sessionId !== undefined) {
            this.#deps.state.setCurrent(created.sessionId);
            this.#deps.state.setLabel(created.sessionId, workspace.title);
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
    async #receipt(inbound, text) {
        await this.#deps.registry.pushText(inbound.channel, inbound.target, text);
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
//# sourceMappingURL=commands.js.map