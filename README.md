# dsh-push-center

把 DSH 的对话完成、暂停、失败、待授权、待回答与任务进度，推送到微信与企业微信，或直接弹成操作系统通知；并支持在聊天里直接应答、续接对话，以及由模型主动调用 push_message 推送消息。

## 支持的通道

| 通道 id | 接入方式 | 能力 |
|---|---|---|
| wechat | 微信 ClawBot（iLink）：扫码登录、长轮询收消息、context_token 回复式推送 | 推送 + 应答 + 续接 |
| wecom-aibot | 企业微信智能机器人：官方 SDK WebSocket 长连接，BotId + Secret | 推送 + 应答 + 续接 |
| wecom-webhook | 企业微信群机器人 webhook | 仅推送 |
| system | 操作系统通知：macOS `osascript`、Linux `notify-send`、Windows PowerShell toast | 仅事件推送（独立开关，不可被 `push_message` 寻址） |

## 安装

从 GitHub 安装：

    dsh plugin --profile web add github:744855705/dsh-push-center

前置条件：Node ≥ 20、DSH ≥ 0.2.3-alpha.2。仓库里不含构建产物（`lib/`、`client/client.js` 都被忽略），
安装时由 `prepare` 脚本（`npm run build`）现场构建，所以首次安装会多花十几秒；装完需要重启 DSH。

也可以从本地包或本地源码目录安装：

    npm pack
    dsh plugin --profile web add /绝对路径/dsh-push-center-0.1.0.tgz

    # 或直接从源码目录装（同样会跑 prepare 构建）
    dsh plugin --profile web add /绝对路径/dsh-push-center

安装后在「设置 → 推送」配置通道。首次使用微信需要扫码登录，并给机器人发一条消息，之后才能主动推送。
企业微信可点「扫码关联」自动填入 Bot ID 与 Secret，也可手工填写。

## 默认去向

1. 调用方显式指定 channel / target
2. 通道的 defaultTargets
3. 最近 24 小时内说过话的对象
4. 该通道已知的全部对象
5. 都没有 → 跳过并在返回值里说明

**一次推送只走一个通道，不会广播**：不指定通道时用「默认通道」；该通道当前不可用（未配置、未启用或正在重连）
就直接报失败并写明原因，不会改发到其他通道。默认通道留空时，取第一个可用通道。

企业微信智能机器人需要至少一个已知会话：你打开与它的会话时即被记录（无需先发消息），也可在「默认会话」里填 userid/chatid。

## 主动推送

模型可调用 push_message：

    { "text": "构建完成", "title": "CI", "channel": "wecom-webhook" }
    { "text": "是否回滚？", "expectReply": true, "options": ["回滚", "保留"], "timeoutMs": 120000 }

`channel` 只接受 wechat / wecom-aibot / wecom-webhook；系统通知是事件驱动的，由设置页的开关决定，工具不接受它。
expectReply 会把读者的一条回复作为工具返回值（单目标限定，超时上限 300000ms）。
成功回执逐行给出 `sent to <渠道>/<目标>`。

## 投递台账

每次出站尝试（含没有收件人的）都会记一行：时间、渠道、目标、成功/失败与错误码，保留最近 50 条，
落盘在 `~/.dsh/push-center/deliveries.json`，设置页「全局设置」末尾的「最近投递」可直接查看——
这是判断「消息到底有没有发出去」的依据。

## 开发

    npm install       # 会跑 prepare，自动构建一次
    npm run check     # typecheck + lint + unit tests
    npm run build     # lib/ + client/client.js

架构在源码里：`src/core/`（领域与端口：types / ports / channel / registry / router / notifier / delivery-log）、
`src/channels/`（每渠道只做协议与渲染）、`src/hooks/`（DSH 接缝：会话事件、审批提问、会话摘要）、
`src/client/`（设置页）、`src/index.ts`（组装根）、`src/tool.ts`（push_message 定义）。

## 许可

MIT

## 图标来源

设置页菜单图标内联在 src/client/icons.tsx，不请求任何远程资源：

- 微信标志: Simple Icons（CC0）
- 企业微信标志: Tencent TDesign icons · logo-wecom（MIT）
- 设置 / Webhook / 系统通知: Lucide（ISC）

商标归各自权利人所有，此处仅用于识别对应平台。
