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
        if (method === RPC_ENDPOINTS.configGet) {
            respond(res, rpcId, { ok: true, value: handlers.getConfig() });
            return;
        }
        if (method === RPC_ENDPOINTS.configSet) {
            if (!isRecord(payload)) {
                respond(res, rpcId, { ok: false, error: { message: 'config.set expects an object' } });
                return;
            }
            respond(res, rpcId, { ok: true, value: await handlers.setConfig(payload) });
            return;
        }
        if (method === RPC_ENDPOINTS.status) {
            respond(res, rpcId, { ok: true, value: handlers.getStatus() });
            return;
        }
        if (method === RPC_ENDPOINTS.channelTest) {
            if (!isRecord(payload) || typeof payload.channel !== 'string') {
                respond(res, rpcId, { ok: false, error: { message: 'channel.test expects { channel }' } });
                return;
            }
            respond(res, rpcId, { ok: true, value: await handlers.testChannel(payload.channel) });
            return;
        }
        if (method === RPC_ENDPOINTS.wecomAibotQrStart) {
            respond(res, rpcId, { ok: true, value: await handlers.startWecomAibotQr() });
            return;
        }
        if (method === RPC_ENDPOINTS.wechatRelogin) {
            respond(res, rpcId, { ok: true, value: await handlers.reloginWechat() });
            return;
        }
        if (method === RPC_ENDPOINTS.systemProbe) {
            respond(res, rpcId, { ok: true, value: handlers.system.probe() });
            return;
        }
        if (method === RPC_ENDPOINTS.systemPoll) {
            const since = isRecord(payload) && typeof payload.since === 'string' ? payload.since : undefined;
            respond(res, rpcId, { ok: true, value: handlers.system.poll(since) });
            return;
        }
        if (method === RPC_ENDPOINTS.systemDelivered) {
            if (!isRecord(payload) || typeof payload.id !== 'string' || typeof payload.shown !== 'boolean') {
                respond(res, rpcId, { ok: false, error: { message: 'system.delivered expects { id, shown }' } });
                return;
            }
            respond(res, rpcId, {
                ok: true,
                value: handlers.system.delivered({
                    id: payload.id,
                    shown: payload.shown,
                    ...(typeof payload.type === 'string' ? { type: payload.type } : {}),
                }),
            });
            return;
        }
        respond(res, rpcId, { ok: false, error: { message: 'unknown endpoint: ' + method } });
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
        system.poll(undefined);
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