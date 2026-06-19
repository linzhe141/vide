import { settingsStore } from '@/electron/store/settingsStore'
import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'

export class SettingsStoreIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('get-settings-store', () => {
      return settingsStore.store
    })

    ipcMainApi.handle('dispatch-settings-store', (data) => {
      Object.entries(data).forEach(([key, newValue]) => {
        settingsStore.set(key, newValue)
      })
    })
  }
}
