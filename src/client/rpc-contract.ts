/** Wire constants shared with the settings page. */
export const RPC_CHANNEL = '/dsh-push-center'
/** Live event stream the page may hold open instead of polling. */
export const EVENTS_PATH = RPC_CHANNEL + '/events'
export const RPC_ENDPOINTS = Object.freeze({
  configGet: 'config.get',
  configSet: 'config.set',
  status: 'status',
  wechatRelogin: 'wechat.relogin',
  wecomAibotQrStart: 'wecom-aibot.qr-start',
  channelTest: 'channel.test',
  systemProbe: 'system.probe',
  systemPoll: 'system.poll',
  systemVerify: 'system.verify',
})
