import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { WechatBotManager } from '@/modules/wechatBotManager'

export class WechatBotIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    const bot = WechatBotManager.getWechatBot(this.appManager.agentManager)
    bot.registerIpcMainHandle()
  }
}
