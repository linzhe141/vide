import type { AppManager } from '../appManager'
import { SettingsStoreIpcMainService } from './services/settingsStore'
import { WindowIpcMainService } from './services/window'
import { AgentIpcMainService } from './services/agent'
import { ThreadIpcMainService } from './services/threads'
import { LLMSettingsIpcMainService } from './services/llmSettings'

export interface IpcMainService {
  registerIpcMainHandle(): void
}

export class IpcService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    const windowIpcMainService = new WindowIpcMainService(this.appManager)
    windowIpcMainService.registerIpcMainHandle()

    const settingsStoreIpcMainService = new SettingsStoreIpcMainService(this.appManager)
    settingsStoreIpcMainService.registerIpcMainHandle()

    const agentIpcMainService = new AgentIpcMainService(this.appManager)
    agentIpcMainService.registerIpcMainHandle()

    const threadIpcMainService = new ThreadIpcMainService(this.appManager)
    threadIpcMainService.registerIpcMainHandle()

    const llmSettingsIpcMainService = new LLMSettingsIpcMainService(this.appManager)
    llmSettingsIpcMainService.registerIpcMainHandle()
  }
}
