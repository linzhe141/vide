import type { AppManager } from '../appManager'
import { SettingsIpcMainService } from './services/settings'
import { WindowIpcMainService } from './services/window'

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
