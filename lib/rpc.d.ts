/** Settings RPC: the /dsh-push-center prefix route the settings page talks to. */
import type { IncomingMessage, ServerResponse } from 'node:http';
/** Endpoint names shared with the client bundle. */
export declare const RPC_CHANNEL = "/dsh-push-center";
/** Live event stream a page may hold open instead of polling. */
export declare const EVENTS_PATH: string;
export declare const RPC_ENDPOINTS: Readonly<{
    configGet: "config.get";
    configSet: "config.set";
    status: "status";
    wechatRelogin: "wechat.relogin";
    wecomAibotQrStart: "wecom-aibot.qr-start";
    channelTest: "channel.test";
    systemProbe: "system.probe";
    systemPoll: "system.poll";
    systemDelivered: "system.delivered";
}>;
/** One event handed to the page. */
export interface RendererEventLike {
    readonly id: string;
    readonly type: string;
    readonly title: string;
    readonly body: string;
    readonly at: number;
}
/** System-notification operations the page drives. */
export interface SystemHandlers {
    /** Whether notifications can be raised here, and how. */
    probe(): unknown;
    /** Drain events after a cursor; also reports the page as live. */
    poll(since: string | undefined): unknown;
    /** Record what the page did with one event (it owns the notification). */
    delivered(input: {
        id: string;
        shown: boolean;
        type?: string;
    }): unknown;
    /** Follow events live; returns the unsubscribe function. */
    subscribe(listener: (event: RendererEventLike) => void): () => void;
}
/** What the route exposes. */
export interface RpcHandlers {
    getConfig(): unknown;
    setConfig(patch: unknown): Promise<unknown>;
    getStatus(): unknown;
    reloginWechat(): Promise<unknown>;
    startWecomAibotQr(): Promise<unknown>;
    /** Send one test message to a channel and report what happened. */
    testChannel(channelId: string): Promise<unknown>;
    /** System notification state; the page owns the permission, the host owns the queue. */
    system: SystemHandlers;
}
/** The minimal web server surface this route needs. */
export interface WebServerLike {
    register(route: {
        kind: 'prefix';
        path: string;
        auth?: 'required' | 'anonymous';
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/**
 * Mount the settings route once the web server exists.
 * @param ctx - plugin context with inject().
 * @param handlers - the settings operations.
 */
export declare function installRpc(ctx: {
    inject(names: string[], callback: (scoped: {
        webServer?: WebServerLike;
    }) => void): void;
}, handlers: RpcHandlers): void;
