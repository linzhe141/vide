import { ipcMainApi } from '../ipcMain'
import { closeWindow, maximizeWindow, minimizeWindow } from '@/electron/window'

export function setupIpcMainHandle() {
  ipcMainApi.handle('close-window', () => {
    closeWindow()
  })

  ipcMainApi.handle('maxmize-window', () => {
    maximizeWindow()
  })

  ipcMainApi.handle('minmize-window', () => {
    minimizeWindow()
  })
}
