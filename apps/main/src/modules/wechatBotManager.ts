import { WechatBot } from '@/modules/wechatBot'
import type { AgentManager } from '@/modules/agentManager'
import { ipcMainApi } from '@/ipc/api/ipcMain'

let wechatBot: WechatBot | null = null
let agentManagerRef: AgentManager | null = null

/**
 * 微信 Bot 单例。内部状态变化时通过 ipcMainApi 把事件推送到 renderer，
 * 让前端 UI（会话列表 / 高亮激活会话）能够同步更新。
 * 复用同一个 AgentManager（同一套 agent session），因此桌面 UI 与微信会话保持同步。
 */
export function getWechatBot(agentManager?: AgentManager): WechatBot {
  if (agentManager) agentManagerRef = agentManager
  if (!wechatBot) {
    if (!agentManagerRef) {
      throw new Error('getWechatBot requires an AgentManager before first use')
    }
    wechatBot = new WechatBot(agentManagerRef, () => {
      try {
        ipcMainApi.send('wechat-sessions-changed', {
          activeSessionId: wechatBot!.getRuntimeStatus().activeSessionId,
          sessions: wechatBot!.getRecentSessions(20),
          status: wechatBot!.getRuntimeStatus(),
        })
      } catch (err) {
        // renderer 尚未就绪时忽略
        console.warn('wechat-sessions-changed send failed', err)
      }
    })
  }
  return wechatBot
}

/** 应用退出时停止长轮询（可选调用）。 */
export function disposeWechatBot(): void {
  if (wechatBot) {
    void wechatBot.stop()
    wechatBot = null
  }
}
