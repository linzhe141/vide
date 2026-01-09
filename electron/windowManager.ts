import { BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IS_DEV } from './utils'
import type { AppManager } from './appManager'
import { ipcMainApi } from './ipc/api/ipcMain'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconPath = path.join(__dirname, '../../../resources/logo.png')

export class WindowManager {
  mainWindow: BrowserWindow = null!

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
        preload: path.join(__dirname, '../preload/index.mjs'),
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    })

    this.mainWindow = mainWindow

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
  }
}
