import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import OpenAI from 'openai'

export class LLMSettingsIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('submit-llm-seetings', (data) => {
      this.appManager.agentManager.createLLMClient(data)
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
