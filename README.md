# dsh-push-center

把 DSH 的对话完成、暂停、失败、待授权、待回答与任务进度，推送到微信与企业微信；并支持在聊天里直接应答、续接对话，以及由模型主动调用 push_message 推送消息。

## 支持的通道

| 通道 id | 接入方式 | 能力 |
|---|---|---|
| wechat | 微信 ClawBot（iLink）：扫码登录、长轮询收消息、context_token 回复式推送 | 推送 + 应答 + 续接 |
| wecom-aibot | 企业微信智能机器人：官方 SDK WebSocket 长连接，BotId + Secret | 推送 + 应答 + 续接 |
| wecom-webhook | 企业微信群机器人 webhook | 仅推送 |

## 安装

    dsh plugin --profile web add dsh-push-center

或安装本地 tgz。安装后在「设置 → 推送」配置通道。首次使用微信需要扫码登录，并给机器人发一条消息，之后才能主动推送。企业微信可点「扫码关联」自动填入 Bot ID 与 Secret，也可手工填写。

## 默认去向

1. 调用方显式指定 channel / target
2. 通道的 defaultTargets
3. 最近 24 小时内说过话的对象
4. 该通道已知的全部对象
5. 都没有 → 跳过并在返回值里说明

默认通道取「第一个启用且配置完整的通道」；它不可用时自动广播到其余通道，并在结果里标记 fallback: 'broadcast'。

企业微信智能机器人需要至少一个已知会话：你打开与它的会话时即被记录（无需先发消息），也可在「默认会话」里填 userid/chatid。

## 主动推送

模型可调用 push_message：

    { "text": "构建完成", "title": "CI", "channel": "wecom-webhook" }
    { "text": "是否回滚？", "expectReply": true, "options": ["回滚", "保留"], "timeoutMs": 120000 }

expectReply 会把读者的一条回复作为工具返回值（单目标限定，超时上限 300000ms）。

## 开发

    npm install
    npm run check     # typecheck + lint + unit tests
    npm run build     # lib/ + client/client.js

架构与扩展方式见 docs/DESIGN.md 与 docs/EXTENDING.md。

## 许可

MIT

## 图标来源

设置页菜单图标内联在 src/client/icons.tsx，不请求任何远程资源：

- 微信标志: Simple Icons（CC0）
- 企业微信标志: Tencent TDesign icons · logo-wecom（MIT）
- 设置 / Webhook: Lucide（ISC）

商标归各自权利人所有，此处仅用于识别对应平台。
