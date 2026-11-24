/** The chat command line: `/sessions`, `/workspaces`, `/current`, `/select`. */
import type { ChatText } from './chat-text.js';
import type { ChatState } from './chat-state.js';
import type { ChannelRegistry } from './registry.js';
import type { HostBridge } from './ports.js';
import type { InboundMessage } from './types.js';
/** What the commands need. */
export interface CommandDeps {
    readonly registry: ChannelRegistry;
    readonly host: HostBridge;
    readonly text: () => ChatText;
    readonly state: ChatState;
}
/**
 * Handles the slash commands a person types in chat.
 *
 * Every command answers with one receipt; selection commands also move the chat
 * to another session or workspace, which is the only state they keep here.
 */
export declare class ChatCommands {
    #private;
    /** @param deps - registry, host session operations, wording and labels. */
    constructor(deps: CommandDeps);
    /**
     * Run one slash command.
     * @param inbound - the normalized message.
     * @param reply - the text, starting with '/'.
     */
    run(inbound: InboundMessage, reply: string): Promise<void>;
}
