import { BrowserWindow, dialog, shell } from 'electron'
import path from 'node:path'
import { IS_DEV } from '../utils'
import { ipcMainApi } from '../ipc/api/ipcMain'
import type { AppManager } from '@/appManager'

// const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconPath = path.join(__dirname, '../../../resources/logo.png')

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
        preload: path.join(__dirname, '../preload/index.mjs'),
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    })

    this.mainWindow = mainWindow
    this.setupExternalNavigation(mainWindow)

    if (IS_DEV) {
      mainWindow.loadURL('http://localhost:1412')
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    } else {
      // Load your file
      mainWindow.loadFile('dist/app/index.html')
    }

    return mainWindow
  }

  init() {
    this.createWindow()
    this.setupWindowListener()
  }

  closeWindow() {
    this.mainWindow!.close()
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

  setupWindowListener() {
    const mainWindow = this.mainWindow!
    mainWindow.on('resize', () => {
      const isMaximized = mainWindow.isMaximized() ?? false
      ipcMainApi.send('changed-window-size', isMaximized)
    })

    mainWindow.on('close', async (event) => {
      if (this.allowClose) return

      const runningSessionCount = this.app.agentManager.countRunningSessions()
      if (!runningSessionCount) return

      event.preventDefault()
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
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
      })

      if (result.response === 1) {
        this.allowClose = true
        mainWindow.close()
      }
    })
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
