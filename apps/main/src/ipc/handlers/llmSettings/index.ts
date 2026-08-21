import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import OpenAI from 'openai'

export class LLMSettingsIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('submit-llm-seetings', () => undefined)

    ipcMainApi.handle('submit-generate-image-settings', ({ apiKey, baseUrl, model }) => {
      this.appManager.agentManager.setGenerateImageConfig({
        apiKey,
        baseUrl,
        model,
      })
    })

    ipcMainApi.handle('submit-web-search-settings', ({ apiKey, searchUrl }) => {
      this.appManager.agentManager.setWebSearchConfig({
        apiKey,
        apiUrl: searchUrl,
      })
    })

    ipcMainApi.handle('verify-llm-settings-connection', ({ apiKey, baseUrl, model }) => {
      return new Promise((resolve) => {
        const client = new OpenAI({
          apiKey,
          baseURL: baseUrl,
        })
        client.chat.completions
          .create({
            messages: [
              { role: 'user', content: 'hello, just test connection, only output 10 character' },
            ],
            model,
          })
          .then(() => resolve({ success: true }))
          .catch((res) => {
            resolve({ success: false, error: String(res) })
          })
      })
    })
  }
}
