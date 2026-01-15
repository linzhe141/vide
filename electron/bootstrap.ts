import { app, BrowserWindow } from 'electron'
import { initApp } from './initApp'
import { logger } from './logger'

export async function start() {
  await app.whenReady()
  logger.info('App is alrady')

  initApp()

  app.on('before-quit', () => {
    logger.info('App is quitting, performing cleanup...')
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // macOS activate TODO
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      //
    }
  })
}
