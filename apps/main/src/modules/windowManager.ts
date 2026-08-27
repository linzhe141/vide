import { existsSync } from 'node:fs'
import { app, BrowserWindow, dialog, shell } from 'electron'
import path from 'node:path'
import { ipcMainApi } from '../ipc/api/ipcMain'
import type { AppManager } from '@/appManager'

const iconPath = path.resolve(__dirname, '../../../../../resources/logo.png')
const rendererIndexPath = path.join(__dirname, '../../app/index.html')

function resolvePreloadPath() {
  const preloadCandidates = [
    path.join(__dirname, '../preload/index.js'),
    path.join(__dirname, '../preload/index.mjs'),
  ]

  return preloadCandidates.find((candidate) => existsSync(candidate)) ?? preloadCandidates[0]
}

export class WindowManager {
  mainWindow: BrowserWindow = null!
  private allowClose = false
  constructor(private app: AppManager) {}

  createWindow() {
    const minHeight = 800
    const minWidth = 1200
    const mainWindow = new BrowserWindow({
      title: 'vide',
      width: minWidth,
      height: minHeight,
      minWidth,
      minHeight,
      icon: iconPath,
      titleBarStyle: 'hidden',
      webPreferences: {
        webSecurity: false,
        preload: resolvePreloadPath(),
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    })

    this.mainWindow = mainWindow
    this.setupExternalNavigation(mainWindow)

    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (rendererUrl) {
      mainWindow.loadURL(rendererUrl)
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    } else {
      mainWindow.loadFile(rendererIndexPath)
    }

    return mainWindow
  }

  init() {
    this.createWindow()
    this.setupWindowListener()
  }

  closeWindow() {
    this.hideWindowToTray()
  }

  maximizeWindow() {
    const mainWindow = this.mainWindow!
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }

  minimizeWindow() {
    this.mainWindow!.minimize()
  }

  showWindow() {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }

    mainWindow.focus()
  }

  async requestAppQuit() {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) {
      app.quit()
      return
    }

    const confirmed = await this.confirmAppQuit()
    if (!confirmed) return

    this.allowClose = true
    app.quit()
  }

  setupWindowListener() {
    const mainWindow = this.mainWindow!
    mainWindow.on('resize', () => {
      const isMaximized = mainWindow.isMaximized() ?? false
      ipcMainApi.send('changed-window-size', isMaximized)
    })

    mainWindow.on('close', async (event) => {
      if (this.allowClose) return

      event.preventDefault()
      this.hideWindowToTray()
    })
  }

  private hideWindowToTray() {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    mainWindow.hide()
    this.app.trayManager.showCloseToTrayMessage()
  }

  private async confirmAppQuit() {
    const runningSessionCount = this.app.agentManager.countRunningSessions()
    if (!runningSessionCount) return true

    const options = {
      type: 'warning' as const,
      buttons: ['取消', '仍然退出'],
      defaultId: 0,
      cancelId: 0,
      title: '存在未完成的会话',
      message:
        '当前存在正在运行的 session。现在关闭应用，未完成 workflow 的 agent message 和 stream event 可能不会被保存。',
      detail:
        runningSessionCount === 1
          ? '建议等待当前 workflow 结束后再退出。'
          : `当前共有 ${runningSessionCount} 个 session 仍在运行，建议等待它们结束后再退出。`,
      noLink: true,
    }

    const result = this.mainWindow.isVisible()
      ? await dialog.showMessageBox(this.mainWindow, options)
      : await dialog.showMessageBox(options)

    return result.response === 1
  }

  private setupExternalNavigation(mainWindow: BrowserWindow) {
    const openExternal = (url: string) => {
      if (!/^https?:\/\//i.test(url)) return false
      shell.openExternal(url)
      return true
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (openExternal(url)) {
        return { action: 'deny' }
      }
      return { action: 'allow' }
    })

    mainWindow.webContents.on('will-navigate', (event, url) => {
      const currentUrl = mainWindow.webContents.getURL()
      if (url !== currentUrl && openExternal(url)) {
        event.preventDefault()
      }
    })
  }
}
