import { app, BrowserWindow } from 'electron'
import { initApp } from './initApp'
import { logger } from './logger'
import type { AppManager } from './appManager'

const PROTOCOL_SCHEME = 'vide'

export async function start() {
  let appManager: AppManager | null = null
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
    return
  }

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [process.argv[1]])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)
  }

  await app.whenReady()
  logger.info('App is ready')

  appManager = initApp()

  app.on('open-url', (event, url) => {
    event.preventDefault()
    logger.info('protocol open-url', url)
  })

  app.on('second-instance', (_event, argv) => {
    const protocolUrl = argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`))
    if (protocolUrl) {
      logger.info('protocol second-instance', protocolUrl)
    }
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('before-quit', () => {
    logger.info('App is quitting, performing cleanup...')
    if (appManager) {
      void appManager.dispose()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // macOS activate TODO
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      appManager = initApp()
    }
  })
}
