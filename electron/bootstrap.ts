import { app, BrowserWindow } from 'electron'
import { initApp } from './initApp'

export async function start() {
  await app.whenReady()
  initApp()

  app.on('before-quit', () => {
    console.log('App is quitting, performing cleanup...')
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
