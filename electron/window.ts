import { BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IS_DEV } from './utils'
import { ipcMainApi } from './ipc/ipcMain'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconPath = path.join(__dirname, '../../../resources/logo.png')
let mainWindow: BrowserWindow | null = null

export function getMainWindow() {
  return mainWindow
}

export function createWindow() {
  const minHeight = 800
  const minWidth = 1200
  mainWindow = new BrowserWindow({
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

  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:1412')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Load your file
    mainWindow.loadFile('dist/app/index.html')
  }

  return mainWindow
}

export function closeWindow() {
  if (mainWindow) mainWindow.close()
}

export function maximizeWindow() {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
}

export function minimizeWindow() {
  if (mainWindow) mainWindow.minimize()
}

export function setupWindowListener() {
  if (!mainWindow) return
  mainWindow.on('resize', () => {
    const isMaximized = mainWindow?.isMaximized() ?? false
    ipcMainApi.send('changed-window-size', isMaximized)
  })
}
