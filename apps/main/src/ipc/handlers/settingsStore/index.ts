import { settingsStore } from '@/modules/settingsStore'
import type { AppManager } from '@/appManager'
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

        if (key === 'webSearchConfig') {
          const config = newValue as { apiKey: string; searchUrl: string }
          this.appManager.agentManager.setWebSearchConfig({
            apiKey: config.apiKey,
            apiUrl: config.searchUrl,
          })
        }

        if (key === 'generateImageConfig') {
          const config = newValue as { apiKey: string; baseUrl: string; model: string }
          this.appManager.agentManager.setGenerateImageConfig(config)
        }
      })
    })
  }
}
