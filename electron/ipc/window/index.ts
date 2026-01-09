import type { AppManager } from '@/electron/appManager'
import { ipcMainApi } from '../ipcMain'
import type { IpcMainService } from '..'

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
