import { existsSync } from 'node:fs'
import { app, BrowserWindow, dialog, shell, type BrowserWindowConstructorOptions } from 'electron'
import path from 'node:path'
import { ipcMainApi } from '../ipc/api/ipcMain'
import type { DemoWindowRole } from '../ipc/api/channels'
import type { AppManager } from '@/appManager'
import { logger, logStartupStep } from '@/logger'
import { resolveRuntimeResourcePath } from '@/utils'

const iconPath = resolveRuntimeResourcePath('logo.png')
const rendererAppPath = path.join(__dirname, '../../app')
const demoEntryName = 'foo.html'

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
  private demoWindows = new Map<'foo', BrowserWindow>()
  constructor(private app: AppManager) {}

  createWindow() {
    const minHeight = 800
    const minWidth = 1200
    const rendererEntry = this.resolveInitialRendererEntry()
    const rendererMode = process.env.ELECTRON_RENDERER_URL ? 'http' : 'file'

    logStartupStep('mainWindow.create.start', {
      rendererMode,
      entry: rendererEntry.htmlFile,
    })

    const mainWindow = this.createBrowserWindow({
      title: 'vide',
      width: minWidth,
      height: minHeight,
      minWidth,
      minHeight,
    })

    this.mainWindow = mainWindow
    this.attachWindowDiagnostics(mainWindow, 'mainWindow')
    this.attachMainWindowStartupObservers(mainWindow)

    this.loadRendererPage(mainWindow, rendererEntry.htmlFile, rendererEntry.query).catch(
      (error) => {
        logger.error('failed to load main renderer page', {
          error,
          entry: rendererEntry.htmlFile,
          query: rendererEntry.query,
        })
      }
    )

    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
      this.openWindowDevTools(mainWindow, 'dev-auto-open')
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

  openMainWindowDevTools() {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) {
      logger.warn('failed to open renderer devtools because main window is unavailable')
      return
    }

    this.showWindow()
    this.openWindowDevTools(mainWindow, 'tray')
  }

  openMultiWindowDemo(role: DemoWindowRole = 'foo') {
    if (role !== 'foo') return

    const fooWindow = this.ensureDemoWindow('foo')
    const notify = () => {
      if (fooWindow.isDestroyed()) return
      fooWindow.webContents.send('multi-window-demo-message', {
        source: 'main',
        target: 'foo',
        message: 'Main clicked open foo',
        sentAt: new Date().toISOString(),
      })
    }

    if (fooWindow.webContents.isLoadingMainFrame()) {
      fooWindow.webContents.once('did-finish-load', notify)
      return
    }

    notify()
  }

  private ensureDemoWindow(role: 'foo') {
    const existingWindow = this.demoWindows.get(role)
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus()
      return existingWindow
    }

    const demoWindow = this.createBrowserWindow({
      title: `vide demo ${role}`,
      width: 640,
      height: 520,
      minWidth: 480,
      minHeight: 420,
      show: false,
    })

    this.attachWindowDiagnostics(demoWindow, `demoWindow:${role}`)
    this.trackDemoWindow(role, demoWindow)
    this.loadRendererPage(demoWindow, demoEntryName, { role }).catch((error) => {
      logger.error('failed to load demo renderer page', {
        error,
        role,
      })
    })

    demoWindow.once('ready-to-show', () => {
      demoWindow.show()
    })

    return demoWindow
  }

  sendMultiWindowDemoMessage(source: DemoWindowRole, message: string, target: DemoWindowRole) {
    const payload = {
      source,
      target,
      message,
      sentAt: new Date().toISOString(),
    }

    if (target === 'main') {
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('multi-window-demo-message', payload)
      }
      return
    }

    if (source === 'main' && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('multi-window-demo-message', payload)
    }

    const targetWindow = this.demoWindows.get(target)
    if (!targetWindow || targetWindow.isDestroyed()) return

    targetWindow.webContents.send('multi-window-demo-message', payload)
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
    // skip localhost or 127.0.0.1

    const openExternal = (url: string) => {
      // Check if URL starts with http:// or https://
      if (!/^https?:\/\//i.test(url)) return false

      // Check if it's localhost or 127.0.0.1
      try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname.toLowerCase()

        // Skip localhost and 127.0.0.1
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return false
        }
      } catch {
        // If URL parsing fails, treat as invalid
        return false
      }

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

  private createBrowserWindow(options: BrowserWindowConstructorOptions) {
    if (!existsSync(iconPath)) {
      logger.warn('browser window icon path does not exist', { iconPath })
    }

    const window = new BrowserWindow({
      icon: iconPath,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        height: 36,
        // dark
        ...{ color: '#030303', symbolColor: '#7E7E7E' },
      },
      webPreferences: {
        webSecurity: false,
        preload: resolvePreloadPath(),
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
      ...options,
    })

    this.setupExternalNavigation(window)

    return window
  }

  private attachMainWindowStartupObservers(window: BrowserWindow) {
    window.once('ready-to-show', () => {
      logStartupStep('mainWindow.ready-to-show')
    })

    window.webContents.once('dom-ready', () => {
      logStartupStep('mainWindow.dom-ready', {
        url: window.webContents.getURL(),
      })
    })

    window.webContents.once('did-finish-load', () => {
      logStartupStep('mainWindow.did-finish-load', {
        url: window.webContents.getURL(),
      })
    })
  }

  private attachWindowDiagnostics(window: BrowserWindow, label: string) {
    window.on('unresponsive', () => {
      logger.error('browser window became unresponsive', {
        label,
        id: window.id,
        url: window.webContents.getURL(),
      })
    })

    window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level < 2) return

      logger.error('renderer console error', {
        label,
        id: window.id,
        level,
        message,
        line,
        sourceId,
        url: window.webContents.getURL(),
      })
    })

    window.webContents.on('preload-error', (_event, path, error) => {
      logger.error('renderer preload script failed', {
        label,
        id: window.id,
        path,
        error,
      })
    })

    window.webContents.on('render-process-gone', (_event, details) => {
      logger.error('renderer process gone', {
        label,
        id: window.id,
        details,
        url: window.webContents.getURL(),
      })
    })

    window.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        logger.error('renderer page failed to load', {
          label,
          id: window.id,
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
        })
      }
    )
  }

  private openWindowDevTools(window: BrowserWindow, reason: 'dev-auto-open' | 'tray') {
    logger.info('opening renderer devtools', {
      reason,
      url: window.webContents.getURL(),
    })
    window.webContents.openDevTools({ mode: 'detach' })
  }

  private loadRendererPage(
    window: BrowserWindow,
    htmlFile: string,
    query: Record<string, string> = {}
  ) {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    const search = new URLSearchParams(query).toString()

    if (rendererUrl) {
      const url = new URL(htmlFile, `${rendererUrl}/`)
      url.search = search
      logStartupStep('renderer.load.start', {
        mode: 'http',
        target: url.toString(),
      })
      return window.loadURL(url.toString())
    }

    const filePath = path.join(rendererAppPath, htmlFile)
    logStartupStep('renderer.load.start', {
      mode: 'file',
      target: filePath,
    })

    return window.loadFile(filePath, {
      search,
    })
  }

  private resolveInitialRendererEntry() {
    const rendererEntryArg = process.argv.find((arg) => arg.startsWith('--renderer-entry='))
    const htmlFile = rendererEntryArg?.slice('--renderer-entry='.length) || 'index.html'
    const query: Record<string, string> = htmlFile === demoEntryName ? { role: 'foo' } : {}

    return {
      htmlFile,
      query,
    }
  }

  private trackDemoWindow(role: 'foo', window: BrowserWindow) {
    this.demoWindows.set(role, window)
    window.on('closed', () => {
      if (this.demoWindows.get(role) === window) {
        this.demoWindows.delete(role)
      }
    })
  }
}
