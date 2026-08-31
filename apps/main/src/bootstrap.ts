import { app, BrowserWindow, protocol } from 'electron'
import { initApp } from './initApp'
import { logger, logStartupStep } from './logger'
import type { AppManager } from './appManager'

const PROTOCOL_SCHEME = 'vide'

protocol.registerSchemesAsPrivileged([
  {
    scheme: PROTOCOL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
])

function findProtocolUrl(argv: string[]) {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`))
}

export async function start() {
  logStartupStep('bootstrap.start', {
    mode: app.isPackaged ? 'production' : 'development',
    pid: process.pid,
  })

  let appManager: AppManager | null = null
  const queuedProtocolUrls: string[] = []
  const routeProtocolUrl = (url: string) => {
    if (!url.startsWith(`${PROTOCOL_SCHEME}://`)) {
      return
    }

    logger.info('protocol received', url)
    if (!appManager) {
      queuedProtocolUrls.push(url)
      return
    }

    appManager.handleProtocolUrl(url).catch((error) => {
      logger.error('failed to handle protocol url', error)
    })
  }

  const initialProtocolUrl = findProtocolUrl(process.argv)
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
    return
  }

  // dev 环境
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [process.argv[1]])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)
  }
  app.disableDomainBlockingFor3DAPIs()
  await app.whenReady()
  logStartupStep('app.whenReady')
  logger.info('App is ready')

  logStartupStep('initApp.start')
  appManager = await initApp()
  logStartupStep('initApp.complete')
  if (initialProtocolUrl) {
    routeProtocolUrl(initialProtocolUrl)
  }
  while (queuedProtocolUrls.length) {
    const nextUrl = queuedProtocolUrls.shift()
    if (nextUrl) {
      routeProtocolUrl(nextUrl)
    }
  }

  app.on('open-url', (event, url) => {
    event.preventDefault()
    routeProtocolUrl(url)
  })

  app.on('second-instance', (_event, argv) => {
    const protocolUrl = findProtocolUrl(argv)
    if (protocolUrl) {
      routeProtocolUrl(protocolUrl)
    }
    if (appManager) {
      appManager.windowManager.showWindow()
      return
    }

    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.on('before-quit', () => {
    logger.info('App is quitting, performing cleanup...')
    if (appManager) {
      appManager.dispose().catch((error) => {
        logger.error('failed to dispose app manager', error)
      })
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('child-process-gone', (_event, details) => {
    logger.error('electron child process gone', details)
  })

  // macOS activate TODO
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (appManager) {
        try {
          appManager.windowManager.init()
        } catch (error) {
          logger.error('failed to recreate main window on activate', error)
          throw error
        }
      } else {
        logStartupStep('initApp.start.activate')
        appManager = await initApp()
        logStartupStep('initApp.complete.activate')
      }
      return
    }

    if (appManager) {
      appManager.windowManager.showWindow()
    }
  })
}
