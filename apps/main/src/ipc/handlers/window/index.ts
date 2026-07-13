import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '../../api/ipcMain'

export class WindowIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    const windowManager = this.appManager.windowManager
    ipcMainApi.handle('close-window', () => {
      windowManager.closeWindow()
    })

    ipcMainApi.handle('maxmize-window', () => {
      windowManager.maximizeWindow()
    })

    ipcMainApi.handle('minmize-window', () => {
      windowManager.minimizeWindow()
    })
  }
}
