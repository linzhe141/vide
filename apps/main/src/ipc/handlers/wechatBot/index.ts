import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import { getWechatBot } from '@/modules/wechatBotManager'
import { settingsStore } from '@/modules/settingsStore'

export class WechatBotIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    const bot = getWechatBot(this.appManager.agentManager)

    ipcMainApi.handle('wechat-get-qrcode', async () => {
      // 前端点击按钮后，后端 fetch 二维码，并开始等待扫码（无前端轮询）
      return bot.getQRCode()
    })

    ipcMainApi.handle('wechat-start-bot', () => {
      try {
        bot.start()
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: String((err as Error)?.message ?? err) }
      }
    })

    ipcMainApi.handle('wechat-stop-bot', async () => {
      await bot.stop()
    })

    ipcMainApi.handle('wechat-logout', async () => {
      await bot.logout()
      settingsStore.set('wechatBotConfig', { botToken: '', activeSessionId: null })
      ipcMainApi.send('wechat-sessions-changed', {
        activeSessionId: null,
        sessions: [],
        status: bot.getRuntimeStatus(),
      })
    })

    ipcMainApi.handle('wechat-get-runtime-status', () => {
      return bot.getRuntimeStatus()
    })

    ipcMainApi.handle('wechat-get-recent-sessions', () => {
      return bot.getRecentSessions(20)
    })
  }
}
