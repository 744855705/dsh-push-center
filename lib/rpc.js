/** Endpoint names shared with the client bundle. */
export const RPC_CHANNEL = '/dsh-push-center';
/** Live event stream a page may hold open instead of polling. */
export const EVENTS_PATH = RPC_CHANNEL + '/events';
export const RPC_ENDPOINTS = Object.freeze({
    configGet: 'config.get',
    configSet: 'config.set',
    status: 'status',
    wechatRelogin: 'wechat.relogin',
    wecomAibotQrStart: 'wecom-aibot.qr-start',
    channelTest: 'channel.test',
    systemProbe: 'system.probe',
    systemPoll: 'system.poll',
    systemTouch: 'system.touch',
    systemDelivered: 'system.delivered',
});
const MAX_BODY = 256 * 1024;
/** Whether a value is a plain JSON object. */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Write one RPC envelope. */
function respond(res, rpcId, result) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'server-response', rpcId, result }));
}
/** Read and parse the request body. */
async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = chunk;
        size += buffer.byteLength;
        if (size > MAX_BODY)
            throw new Error('request body too large');
        chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Read `payload.channel`; validation already guaranteed it is a string. */
function readChannel(payload) {
    return isRecord(payload) && typeof payload.channel === 'string' ? payload.channel : '';
}
/** Read `payload.since`: an absent cursor means "whatever is queued". */
function readSince(payload) {
    return isRecord(payload) && typeof payload.since === 'string' ? payload.since : undefined;
}
/** Read a delivered-event report; validation already checked both fields. */
function readDelivered(payload) {
    const record = isRecord(payload) ? payload : {};
    return {
        id: typeof record.id === 'string' ? record.id : '',
        shown: record.shown === true,
        ...(typeof record.type === 'string' ? { type: record.type } : {}),
    };
}
/** The settings surface, in one table instead of a dispatch chain. */
const ENDPOINTS = {
    [RPC_ENDPOINTS.configGet]: { run: (handlers) => handlers.getConfig() },
    [RPC_ENDPOINTS.configSet]: {
        validate: (payload) => (isRecord(payload) ? null : 'config.set expects an object'),
        run: (handlers, payload) => handlers.setConfig(payload),
    },
    [RPC_ENDPOINTS.status]: { run: (handlers) => handlers.getStatus() },
    [RPC_ENDPOINTS.channelTest]: {
        validate: (payload) => (readChannel(payload).length > 0 ? null : 'channel.test expects { channel }'),
        run: (handlers, payload) => handlers.testChannel(readChannel(payload)),
    },
    [RPC_ENDPOINTS.wecomAibotQrStart]: { run: (handlers) => handlers.startWecomAibotQr() },
    [RPC_ENDPOINTS.wechatRelogin]: { run: (handlers) => handlers.reloginWechat() },
    [RPC_ENDPOINTS.systemProbe]: { run: (handlers) => handlers.system.probe() },
    [RPC_ENDPOINTS.systemPoll]: { run: (handlers, payload) => handlers.system.poll(readSince(payload)) },
    [RPC_ENDPOINTS.systemTouch]: { run: (handlers) => { handlers.system.touch(); return { ok: true }; } },
    [RPC_ENDPOINTS.systemDelivered]: {
        validate: (payload) => (isRecord(payload) && typeof payload.id === 'string' && typeof payload.shown === 'boolean'
            ? null
            : 'system.delivered expects { id, shown }'),
        run: (handlers, payload) => handlers.system.delivered(readDelivered(payload)),
    },
};
/**
 * Serve one RPC exchange.
 * @param req - the HTTP request.
 * @param res - the HTTP response.
 * @param handlers - the settings operations.
 */
async function serve(req, res, handlers) {
    if (req.method === 'GET') {
        const pathname = (req.url ?? '').split('?', 1)[0] ?? '';
        if (pathname.endsWith('/events')) {
            serveEvents(req, res, handlers.system);
            return;
        }
    }
    if (req.method !== 'POST') {
        res.writeHead(404);
        res.end('not found');
        return;
    }
    let body;
    try {
        body = await readBody(req);
    }
    catch {
        res.writeHead(400);
        res.end('body is not JSON');
        return;
    }
    if (!isRecord(body) || typeof body.rpcId !== 'string' || typeof body.method !== 'string') {
        res.writeHead(400);
        res.end('invalid client-request');
        return;
    }
    const rpcId = body.rpcId;
    const method = body.method;
    const payload = body.payload;
    try {
        const endpoint = ENDPOINTS[method];
        if (endpoint === undefined) {
            respond(res, rpcId, { ok: false, error: { message: 'unknown endpoint: ' + method } });
            return;
        }
        const refused = endpoint.validate?.(payload) ?? null;
        if (refused !== null) {
            respond(res, rpcId, { ok: false, error: { message: refused } });
            return;
        }
        respond(res, rpcId, { ok: true, value: await endpoint.run(handlers, payload) });
    }
    catch (error) {
        respond(res, rpcId, { ok: false, error: { message: error instanceof Error ? error.message : String(error) } });
    }
}
/** Milliseconds between keep-alive comments on an idle stream. */
const STREAM_HEARTBEAT_MS = 15_000;
/**
 * Hold one event stream open for a page.
 *
 * The web server hands the handler the raw response on purpose ("may hold the
 * response open, e.g. SSE"), and its compression filter skips text/event-stream,
 * so writes reach the page as they happen.
 * @param req - the GET request.
 * @param res - the response this handler owns.
 * @param system - the queue and probe.
 */
function serveEvents(req, res, system) {
    res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
    });
    res.write(': connected\n\n');
    const unsubscribe = system.subscribe((event) => {
        res.write('data: ' + JSON.stringify(event) + '\n\n');
    });
    const heartbeat = setInterval(() => {
        // A keep-alive must never consume: it only says "this page is still here".
        system.touch();
        res.write(': ping\n\n');
    }, STREAM_HEARTBEAT_MS);
    const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
    };
    req.on('close', close);
    res.on('close', close);
}
/**
 * Mount the settings route once the web server exists.
 * @param ctx - plugin context with inject().
 * @param handlers - the settings operations.
 */
export function installRpc(ctx, handlers) {
    ctx.inject(['connection', 'webServer'], (scoped) => {
        const server = scoped.webServer;
        if (server === undefined || typeof server.register !== 'function')
            return;
        server.register({
            kind: 'prefix',
            path: RPC_CHANNEL,
            auth: 'required',
            handler: (req, res) => serve(req, res, handlers),
        });
    });
}
//# sourceMappingURL=rpc.js.map