import { createGenerateImageClient } from '@/agent/image'
import type { AppManager } from './appManager'
import { settingsStore } from './store/settingsStore'
import { createLLMClient } from '@/agent/llm'
export class AgentManager {
  constructor(private app: AppManager) {}

  init() {
    this.createLLMClient()
    this.createGenerateImageClient()
  }

  createLLMClient(config?: { apiKey: string; baseUrl: string; model: string }) {
    const apiKey = config ? config.apiKey : settingsStore.get('llmConfig').apiKey
    const baseURL = config ? config.baseUrl : settingsStore.get('llmConfig').baseUrl
    const model = config ? config.model : settingsStore.get('llmConfig').model

    if (apiKey && baseURL && model) createLLMClient({ apiKey, baseURL, model })
  }

  createGenerateImageClient(config?: { apiKey: string; baseUrl: string; model: string }) {
    const apiKey = config ? config.apiKey : settingsStore.get('generateImageConfig').apiKey
    const baseURL = config ? config.baseUrl : settingsStore.get('generateImageConfig').baseUrl
    const model = config ? config.model : settingsStore.get('generateImageConfig').model
    if (apiKey && baseURL && model) createGenerateImageClient({ apiKey, baseURL, model })
  }
}
