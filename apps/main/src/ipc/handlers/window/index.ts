import { BrowserWindow } from 'electron'
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

    ipcMainApi.handleWithEvent('close-current-window', (event) => {
      const currentWindow = BrowserWindow.fromWebContents(event.sender)
      currentWindow?.close()
    })

    ipcMainApi.handle('maxmize-window', () => {
      windowManager.maximizeWindow()
    })

    ipcMainApi.handle('minmize-window', () => {
      windowManager.minimizeWindow()
    })

    ipcMainApi.handle('open-multi-window-demo', ({ role } = {}) => {
      windowManager.openMultiWindowDemo(role)
    })

    ipcMainApi.handle('multi-window-demo-send', ({ source, target, message }) => {
      windowManager.sendMultiWindowDemoMessage(source, message, target)
    })
  }
}
