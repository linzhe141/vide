import OpenAI from 'openai'
import type { AppManager } from './appManager'
import { settingsStore } from './store/settingsStore'
export class AgentManager {
  protected llmClient: OpenAI = null!
  constructor(private app: AppManager) {}

  init() {
    this.createLLMClient()
  }

  getLLMClient() {
    return this.llmClient
  }

  createLLMClient(config?: { apiKey: string; baseUrl: string }) {
    const apiKey = config ? config.apiKey : settingsStore.get('llmConfig').apiKey
    const baseURL = config ? config.baseUrl : settingsStore.get('llmConfig').baseUrl
    const client = new OpenAI({
      apiKey,
      baseURL,
    })
    this.llmClient = client
  }
}
