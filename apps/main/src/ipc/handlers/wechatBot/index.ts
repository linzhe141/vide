import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '@/ipc/api/ipcMain'

export class WechatBotIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    const manager = this.appManager.wechatBotManager

    ipcMainApi.handle('wechat-get-qrcode', async () => {
      return manager.getQRCode()
    })

    ipcMainApi.handle('wechat-start-bot', () => {
      try {
        manager.start()
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: String((err as Error)?.message ?? err) }
      }
    })

    ipcMainApi.handle('wechat-stop-bot', async () => {
      await manager.stop()
    })

    ipcMainApi.handle('wechat-logout', async () => {
      await manager.logout()
    })

    ipcMainApi.handle('wechat-get-runtime-status', () => {
      return manager.getRuntimeStatus()
    })
  }
}
