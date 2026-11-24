/** Text of an unknown thrown value. */
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/** A string field, or undefined. */
function text(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
/** The session behind a request agent. */
function sessionIdOf(agent) {
    const view = agent;
    return text(view?.id) ?? text(view?.session?.id) ?? text(view?.session?.header?.id);
}
/**
 * Compose a private branch over the request signal so answering from chat can
 * cancel only the browser delivery, leaving the host's own cancellation intact.
 * @param request - the shared request object.
 * @returns the composed signal plus the browser abort, or null when unavailable.
 */
function detachBrowser(request) {
    if (request === null || typeof request !== 'object')
        return null;
    const original = request.signal;
    if (original !== undefined && !(original instanceof AbortSignal))
        return null;
    const branch = new AbortController();
    const signal = original === undefined ? branch.signal : AbortSignal.any([original, branch.signal]);
    try {
        request.signal = signal;
    }
    catch {
        return null;
    }
    return { signal, cancel: () => branch.abort(new Error('answered elsewhere')) };
}
/**
 * One promise settling when a request signal aborts.
 * Approvals release (delegate downstream); questions reject, because the tool
 * call awaits the outermost answerer with no timeout of its own.
 * @param signal - the request lifetime.
 * @param mode - how an abort settles the gate.
 * @returns the promise and its disposer.
 */
function abortGate(signal, mode) {
    if (signal === undefined)
        return { promise: new Promise(() => { }), dispose: () => { } };
    let fire = null;
    const promise = new Promise((resolve, reject) => {
        fire = () => { if (mode === 'release')
            resolve(null);
        else
            reject(signal.reason ?? new Error('request aborted')); };
        if (signal.aborted)
            fire();
        else
            signal.addEventListener('abort', fire, { once: true });
    });
    return { promise, dispose: () => { if (fire !== null)
            signal.removeEventListener('abort', fire); } };
}
/** Bridges DSH answerer waterfalls to the router. */
export class DshInteractions {
    #ctx;
    #router;
    /**
     * @param ctx - host context with the event bus.
     * @param router - the inbound router that owns the chat side.
     */
    constructor(ctx, router) {
        this.#ctx = ctx;
        this.#router = router;
    }
    /** Register both answerer listeners; returns the disposer. */
    attach() {
        const disposers = [];
        try {
            disposers.push(this.#ctx.on('approval/request', ((request, next) => this.#approval(request, next)), { prepend: true }));
        }
        catch (error) {
            this.#ctx.logger.warn('[push] cannot listen for approvals: %s', messageOf(error));
        }
        try {
            disposers.push(this.#ctx.on('user-questions/request', ((request, next) => this.#question(request, next)), { prepend: true }));
        }
        catch (error) {
            this.#ctx.logger.warn('[push] cannot listen for questions: %s', messageOf(error));
        }
        return () => { for (const dispose of disposers) {
            try {
                dispose();
            }
            catch { /* already gone */ }
        } };
    }
    async #approval(request, next) {
        const agent = request?.agent;
        const sessionId = sessionIdOf(agent);
        if (sessionId === undefined)
            return next();
        const source = request;
        const browser = detachBrowser(request);
        const lifetime = browser?.signal ?? (source.signal instanceof AbortSignal ? source.signal : undefined);
        const view = {
            sessionId,
            toolName: text(source.toolName) ?? 'unknown tool',
            ...(text(source.callId) === undefined ? {} : { callId: text(source.callId) }),
            ...(text(source.reason) === undefined ? {} : { reason: text(source.reason) }),
            ...(lifetime === undefined ? {} : { signal: lifetime }),
        };
        const mine = this.#router.onApproval(view);
        const downstream = Promise.resolve().then(() => next());
        const gate = abortGate(view.signal, 'release');
        try {
            const winner = await Promise.race([
                mine.then((value) => ({ side: 'chat', value })),
                downstream.then((value) => ({ side: 'down', value })),
                gate.promise,
            ]);
            if (winner.side === 'chat' && winner.value !== null) {
                browser?.cancel();
                return winner.value;
            }
            this.#router.drop('approval', sessionId, view.callId);
            return winner.side === 'chat' ? downstream : winner.value;
        }
        finally {
            gate.dispose();
        }
    }
    async #question(request, next) {
        const source = request;
        const sessionId = sessionIdOf(source?.agent) ?? '';
        const questions = Array.isArray(source?.questions) ? source.questions : [];
        if (questions.length === 0)
            return next();
        const browser = detachBrowser(request);
        const lifetime = browser?.signal ?? (source?.signal instanceof AbortSignal ? source.signal : undefined);
        const view = {
            sessionId,
            questions,
            ...(text(source?.wait?.callId) === undefined
                ? {}
                : { callId: text(source?.wait?.callId) }),
            ...(lifetime === undefined ? {} : { signal: lifetime }),
        };
        const mine = this.#router.onQuestion(view);
        const downstream = Promise.resolve().then(() => next());
        const gate = abortGate(view.signal, 'throw');
        try {
            const winner = await Promise.race([
                mine.then((value) => ({ side: 'chat', value })),
                downstream.then((value) => ({ side: 'down', value })),
                gate.promise,
            ]);
            if (winner.side === 'chat' && winner.value !== null) {
                browser?.cancel();
                return winner.value;
            }
            this.#router.drop('question', sessionId, view.callId);
            return winner.side === 'chat' ? downstream : winner.value;
        }
        catch (error) {
            this.#router.drop('question', sessionId, view.callId);
            throw error;
        }
        finally {
            gate.dispose();
        }
    }
}
//# sourceMappingURL=interactions.js.map