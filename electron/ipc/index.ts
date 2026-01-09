import type { AppManager } from '../appManager'
import { SettingsIpcMainService } from './settings'
import { WindowIpcMainService } from './window'

export interface IpcMainService {
  registerIpcMainHandle(): void
}

export class IpcService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    const windowIpcMainService = new WindowIpcMainService(this.appManager)
    windowIpcMainService.registerIpcMainHandle()

    const settingsStoreIpcMainService = new SettingsIpcMainService(
      this.appManager
    )
    settingsStoreIpcMainService.registerIpcMainHandle()
  }
}
