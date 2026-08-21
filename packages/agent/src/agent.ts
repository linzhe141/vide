import { restoreSessionFromPersistedData, type PersistedSessionData } from './persistence'
import { Session } from './session'

export class Agent {
  private webSearchConfig = {
    apiKey: '',
    apiUrl: '',
  }
  private generateImageConfig = {
    apiKey: '',
    baseUrl: '',
    model: '',
  }

  get settings() {
    return {
      webSearchConfig: this.webSearchConfig,
      generateImageConfig: this.generateImageConfig,
    }
  }

  setWebSearchConfig(config: { apiKey: string; apiUrl: string }) {
    this.webSearchConfig.apiKey = config.apiKey
    this.webSearchConfig.apiUrl = config.apiUrl
  }

  setGenerateImageConfig(config: { apiKey: string; baseUrl: string; model: string }) {
    this.generateImageConfig.apiKey = config.apiKey
    this.generateImageConfig.baseUrl = config.baseUrl
    this.generateImageConfig.model = config.model
  }

  createSession(data: {
    workspacePath: string | null
    autoApprove: boolean
    thinkingMode: boolean
  }) {
    const newSession = new Session(this.settings)
    // 设置默认分支 main 的 head 和 source 为 null
    newSession.branches[newSession.activeBranch] = { head: null, source: null }
    if (data.workspacePath) {
      newSession.workspacePath = data.workspacePath
    }
    newSession.autoApprove = data.autoApprove
    newSession.thinkingMode = data.thinkingMode

    return newSession
  }

  restoreSession(data: PersistedSessionData) {
    return restoreSessionFromPersistedData(data, this.settings)
  }
}
