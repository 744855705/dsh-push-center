/** Chat-facing wording. Independent of the settings page language on purpose. */
import type { QuestionItem } from './types.js';
/** Language used for messages pushed into chat. */
export type ChatLocale = 'zh' | 'en';
/** Wording for one chat language. */
export interface ChatText {
    approvalTitle(workspace?: string): string;
    approvalBody(tool: string, reason?: string): string;
    approveHint: string;
    approveLabel: string;
    rejectLabel: string;
    questionTitle(workspace?: string): string;
    questionBody(questions: readonly QuestionItem[]): string;
    approveReceipt(workspace: string, tool: string): string;
    rejectReceipt(workspace: string, tool: string): string;
    answerReceipt(summary: string): string;
    unknownApprovalReply(reply: string, tool: string): string;
    unknownQuestionReply(reply: string, prompt: string): string;
    alreadyHandled: string;
    noSession: string;
    sentTo(session: string): string;
    sendFailed(error: string): string;
    sessionsIntro: string;
    workspacesIntro: string;
    noSessions: string;
    noWorkspaces: string;
    sessionListFailed: string;
    workspaceListFailed: string;
    currentNone: string;
    currentLine(label: string, id: string): string;
    selectUsage: string;
    selectInvalid: string;
    switchedSession(label: string, id: string): string;
    switchedWorkspace(title: string): string;
    createdWorkspace(title: string): string;
    createFailed(title: string, error: string): string;
    help: string;
    replyHint: string;
    welcome: string;
    noPendingApproval: string;
    testTitle(channel: string): string;
    testBody(channel: string, at: string): string;
}
/** Wording table for one language. */
export declare function chatText(locale: ChatLocale): ChatText;
