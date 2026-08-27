import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '@/ipc/api/ipcMain'

export class GitHubAuthIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    const manager = this.appManager.githubAuthManager

    ipcMainApi.handle('github-auth-start', async () => {
      await manager.startAuth()
      return { ok: true as const }
    })

    ipcMainApi.handle('github-auth-logout', async () => {
      await manager.logout()
    })

    ipcMainApi.handle('github-auth-get-runtime-status', () => manager.getRuntimeStatus())
  }
}
