const ZH = {
    approvalTitle: (workspace) => (workspace === undefined ? '🔐 需要授权' : `🔐 [${workspace}] 需要授权`),
    approvalBody: (tool, reason) => [`操作: ${tool}`, ...(reason === undefined ? [] : [`原因: ${reason}`])].join('\n'),
    approveHint: '回复 Y 批准 / N 拒绝',
    approveLabel: '批准',
    rejectLabel: '拒绝',
    questionTitle: (workspace) => (workspace === undefined ? '❓ 需要回答' : `❓ [${workspace}] 需要回答`),
    questionBody: (questions) => questions
        .map((question, index) => {
        const lines = [];
        if (questions.length > 1)
            lines.push(`【问题 ${index + 1}】`);
        if (question.header !== undefined)
            lines.push(`📌 ${question.header}`);
        lines.push(question.question);
        const options = question.options ?? [];
        if (options.length > 0) {
            options.forEach((option, at) => {
                const suffix = option.description === undefined ? '' : ` — ${option.description}`;
                lines.push(`  ${at + 1}. ${option.label}${suffix}`);
            });
            lines.push(question.multiSelect === true ? '回复选项序号（可多选，空格分隔）或自定义文字' : '回复选项序号或自定义文字');
        }
        else {
            lines.push('直接回复文字作答');
        }
        return lines.join('\n');
    })
        .join('\n\n'),
    approveReceipt: (workspace, tool) => `✅ 已批准${workspace}的 ${tool} 操作`,
    rejectReceipt: (workspace, tool) => `🚫 已拒绝${workspace}的 ${tool} 操作`,
    answerReceipt: (summary) => `✅ 已提交回答: ${summary}`,
    unknownApprovalReply: (reply, tool) => `❓ 无法识别「${reply}」。当前有待处理的授权请求（${tool}），请回复 Y 批准 / N 拒绝`,
    unknownQuestionReply: (reply, prompt) => `❓ 无法识别「${reply}」。\n\n${prompt}`,
    alreadyHandled: 'ℹ️ 该请求已在其他端处理，忽略本次回复',
    noSession: 'ℹ️ 还没有可续接的会话（先让 DSH 推送一条通知）',
    sentTo: (session) => `📨 已发送到${session}会话，排队等待执行`,
    sendFailed: (error) => `⚠️ 发送失败: ${error}`,
    sessionsIntro: '💬 选择要续接的对话（回复 /sel s 序号）：',
    workspacesIntro: '📁 选择工作区（回复 /sel w 序号）：',
    noSessions: 'ℹ️ 还没有可选择的对话（可先用 /workspace 切换工作区新建一个）',
    noWorkspaces: 'ℹ️ 还没有注册任何工作区（先在 Web 界面创建一个）',
    sessionListFailed: '⚠️ 获取会话列表失败：当前宿主未提供会话查询服务',
    workspaceListFailed: '⚠️ 获取工作区列表失败：当前宿主未提供工作区注册表',
    currentNone: 'ℹ️ 当前没有选中的对话（/sessions 选择，/workspace 切换工作区）',
    currentLine: (label, id) => `📍 当前对话：${label}${id.slice(0, 8)}…`,
    selectUsage: '❓ 用法: /sel s <序号> 选择对话，/sel w <序号> 选择工作区',
    selectInvalid: '❓ 无效的序号，请先用 /sessions 或 /workspace 调出菜单',
    switchedSession: (label, id) => `✅ 已切换到对话 ${label}${id.slice(0, 8)}…，直接发消息即可续接`,
    switchedWorkspace: (title) => `✅ 已切换到工作区「${title}」的对话`,
    createdWorkspace: (title) => `✅ 工作区「${title}」暂无对话，已新建一个，直接发消息即可开始`,
    createFailed: (title, error) => `⚠️ 在工作区「${title}」新建对话失败: ${error}`,
    help: [
        '📱 可用命令：',
        '  /sessions — 选择要续接的对话',
        '  /workspace — 切换工作区（沿用其最新对话，没有则新建）',
        '  /current — 查看当前对话',
        '',
        '直接发送文字即续接当前对话；有待处理的审批/问题时，回复 Y/N 或选项序号。',
    ].join('\n'),
    replyHint: '回复即可继续本会话',
    welcome: '已连接 DSH 推送。回复即可继续最近的会话；发 /help 查看命令。',
    noPendingApproval: 'ℹ️ 当前没有待处理的审批（可能已在其他端处理）',
    // Deliberately long: a test push has to stand out from the event stream.
    testTitle: (channel) => `🧪 推送测试 · ${channel}`,
    testBody: (channel, at) => [
        '🧪🧪🧪 DSH 推送测试 🧪🧪🧪',
        `渠道: ${channel}`,
        `时间: ${at}`,
        '收到这条就说明这条渠道的主动推送是通的。',
        '',
        ...Array.from({ length: 5 }, () => '测试'.repeat(20)),
    ].join('\n'),
};
const EN = {
    approvalTitle: (workspace) => (workspace === undefined ? '🔐 Approval required' : `🔐 [${workspace}] Approval required`),
    approvalBody: (tool, reason) => [`Tool: ${tool}`, ...(reason === undefined ? [] : [`Reason: ${reason}`])].join('\n'),
    approveHint: 'Reply Y to approve / N to reject',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
    questionTitle: (workspace) => (workspace === undefined ? '❓ A question is waiting' : `❓ [${workspace}] A question is waiting`),
    questionBody: (questions) => questions
        .map((question, index) => {
        const lines = [];
        if (questions.length > 1)
            lines.push(`[Question ${index + 1}]`);
        if (question.header !== undefined)
            lines.push(`📌 ${question.header}`);
        lines.push(question.question);
        const options = question.options ?? [];
        if (options.length > 0) {
            options.forEach((option, at) => {
                const suffix = option.description === undefined ? '' : ` — ${option.description}`;
                lines.push(`  ${at + 1}. ${option.label}${suffix}`);
            });
            lines.push(question.multiSelect === true ? 'Reply with option numbers (space separated) or your own text' : 'Reply with an option number or your own text');
        }
        else {
            lines.push('Reply with text');
        }
        return lines.join('\n');
    })
        .join('\n\n'),
    approveReceipt: (workspace, tool) => `✅ Approved ${workspace}${tool}`,
    rejectReceipt: (workspace, tool) => `🚫 Rejected ${workspace}${tool}`,
    answerReceipt: (summary) => `✅ Answer submitted: ${summary}`,
    unknownApprovalReply: (reply, tool) => `❓ Cannot read "${reply}". A ${tool} approval is pending: reply Y to approve / N to reject`,
    unknownQuestionReply: (reply, prompt) => `❓ Cannot read "${reply}".\n\n${prompt}`,
    alreadyHandled: 'ℹ️ Another surface already answered this request',
    noSession: 'ℹ️ No conversation to continue yet (wait for DSH to push one first)',
    sentTo: (session) => `📨 Queued for ${session}`,
    sendFailed: (error) => `⚠️ Send failed: ${error}`,
    sessionsIntro: '💬 Pick a conversation to continue (reply /sel s <n>):',
    workspacesIntro: '📁 Pick a workspace (reply /sel w <n>):',
    noSessions: 'ℹ️ No conversations to pick (use /workspace to create one)',
    noWorkspaces: 'ℹ️ No workspaces registered yet (create one in the Web UI)',
    sessionListFailed: '⚠️ Cannot list conversations: this host exposes no session query service',
    workspaceListFailed: '⚠️ Cannot list workspaces: this host exposes no workspace registry',
    currentNone: 'ℹ️ No conversation selected (/sessions to pick, /workspace to switch)',
    currentLine: (label, id) => `📍 Current conversation: ${label}${id.slice(0, 8)}…`,
    selectUsage: '❓ Usage: /sel s <n> picks a conversation, /sel w <n> picks a workspace',
    selectInvalid: '❓ Unknown index; run /sessions or /workspace first',
    switchedSession: (label, id) => `✅ Now continuing ${label}${id.slice(0, 8)}…`,
    switchedWorkspace: (title) => `✅ Continuing the latest conversation in "${title}"`,
    createdWorkspace: (title) => `✅ Created a conversation in "${title}"; send a message to start`,
    createFailed: (title, error) => `⚠️ Could not create a conversation in "${title}": ${error}`,
    help: [
        '📱 Commands:',
        '  /sessions — pick the conversation to continue',
        '  /workspace — switch workspace (latest conversation, or a new one)',
        '  /current — show the current conversation',
        '',
        'Plain text continues the current conversation; while an approval or question is pending reply Y/N or an option number.',
    ].join('\n'),
    replyHint: 'Reply to continue this conversation',
    welcome: 'Connected to DSH push. Reply to continue the latest conversation; send /help for commands.',
    noPendingApproval: 'ℹ️ No approval is pending (it may have been answered elsewhere)',
    // Deliberately long: a test push has to stand out from the event stream.
    testTitle: (channel) => `🧪 Push test · ${channel}`,
    testBody: (channel, at) => [
        '🧪🧪🧪 DSH push test 🧪🧪🧪',
        `Channel: ${channel}`,
        `Time: ${at}`,
        'Receiving this proves proactive delivery works on this channel.',
        '',
        ...Array.from({ length: 5 }, () => 'TEST '.repeat(20).trim()),
    ].join('\n'),
};
/** Wording table for one language. */
export function chatText(locale) {
    return locale === 'en' ? EN : ZH;
}
//# sourceMappingURL=chat-text.js.map