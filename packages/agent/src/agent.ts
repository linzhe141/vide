import { Session } from './session'

export class Agent {
  private webSearchConfig = {
    apiKey: '',
    apiUrl: '',
  }
  get settings() {
    return {
      webSearchConfig: this.webSearchConfig,
    }
  }

  setWebSearchConfig(config: { apiKey: string; apiUrl: string }) {
    this.webSearchConfig.apiKey = config.apiKey
    this.webSearchConfig.apiUrl = config.apiUrl
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
}
