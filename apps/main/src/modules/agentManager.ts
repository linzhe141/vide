import { createLLMClient, setWebSearchConfig, createGenerateImageClient } from '@vide/agent'
import { settingsStore } from './settingsStore'
import type { AppManager } from '@/appManager'
export class AgentManager {
  constructor(private app: AppManager) {}

  init() {
    this.createLLMClient()
    this.createGenerateImageClient()
    this.createWebSearchClient()
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

  createWebSearchClient(config?: { apiKey: string; searchUrl: string }) {
    const apiKey = config ? config.apiKey : settingsStore.get('webSearchConfig').apiKey
    const searchUrl = config ? config.searchUrl : settingsStore.get('webSearchConfig').searchUrl
    if (apiKey && searchUrl) setWebSearchConfig({ apiKey, searchUrl })
  }
}
