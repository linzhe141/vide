import { setupIpcMainHandle as setupSettingIpcHandle } from './settings'
import { setupIpcMainHandle as setupWindowIpcHandle } from './window'

export function setupIpcHandle() {
  setupSettingIpcHandle()
  setupWindowIpcHandle()
}
