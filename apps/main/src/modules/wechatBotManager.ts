import { WechatBot } from '@/modules/wechatBot'
import type { AgentManager } from '@/modules/agentManager'

export class WechatBotManager {
  private static wechatBot: WechatBot | null = null
  private static agentManagerRef: AgentManager | null = null

  /**
   * 微信 Bot 单例。复用同一个 AgentManager（同一套 agent session），
   * 因此桌面 UI 与微信会话保持同步。
   */
  static getWechatBot(agentManager?: AgentManager): WechatBot {
    if (agentManager) this.agentManagerRef = agentManager
    if (!this.wechatBot) {
      if (!this.agentManagerRef) {
        throw new Error('WechatBotManager.getWechatBot requires an AgentManager before first use')
      }
      this.wechatBot = new WechatBot(this.agentManagerRef)
    }
    return this.wechatBot
  }

  /** 应用退出时停止长轮询（可选调用）。 */
  static disposeWechatBot(): void {
    if (this.wechatBot) {
      void this.wechatBot.stop()
      this.wechatBot = null
    }
  }
}
