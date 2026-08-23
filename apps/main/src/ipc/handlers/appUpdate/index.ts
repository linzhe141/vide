import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '@/ipc/api/ipcMain'

export class AppUpdateIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('get-app-update-status', () =>
      Promise.resolve(this.appManager.getUpdateStatus())
    )
    ipcMainApi.handle('check-for-updates', () => this.appManager.checkForUpdates())
    ipcMainApi.handle('install-update-and-restart', () => {
      this.appManager.installUpdateAndRestart()
      return Promise.resolve()
    })
  }
}
