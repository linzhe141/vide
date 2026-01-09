import { createWindow, setupWindowListener } from './window'
import { setupApplicationMenu } from './menu'
import { setupIpcHandle } from './ipc'

export function initApp() {
  createWindow()

  setupIpcHandle()
  setupApplicationMenu()
  setupWindowListener()
}
