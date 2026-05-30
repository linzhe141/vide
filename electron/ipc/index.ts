import type { AppManager } from '../appManager'
import { SettingsStoreIpcMainService } from './services/settingsStore'
import { WindowIpcMainService } from './services/window'
import { AgentIpcMainService } from './services/agent'
import { SessionIpcMainService } from './services/sessions'
import { LLMSettingsIpcMainService } from './services/llmSettings'
import { DevIpcMainService } from './services/dev'
import { WorkspaceIpcMainService } from './services/workspace'

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

    const sessionIpcMainService = new SessionIpcMainService(this.appManager)
    sessionIpcMainService.registerIpcMainHandle()

    const llmSettingsIpcMainService = new LLMSettingsIpcMainService(this.appManager)
    llmSettingsIpcMainService.registerIpcMainHandle()

    const devIpcMainService = new DevIpcMainService(this.appManager)
    devIpcMainService.registerIpcMainHandle()

    const workspaceIpcMainService = new WorkspaceIpcMainService(this.appManager)
    workspaceIpcMainService.registerIpcMainHandle()
  }
}
