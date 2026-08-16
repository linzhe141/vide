import type { AppManager } from '../appManager'
import { SettingsStoreIpcMainService } from './handlers/settingsStore'
import { WindowIpcMainService } from './handlers/window'
import { AgentIpcMainService } from './handlers/agent'
import { SessionIpcMainService } from './handlers/sessions'
import { LLMSettingsIpcMainService } from './handlers/llmSettings'
import { DevIpcMainService } from './handlers/dev'
import { WorkspaceIpcMainService } from './handlers/workspace'
import { WechatBotIpcMainService } from './handlers/wechatBot'

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

    const wechatBotIpcMainService = new WechatBotIpcMainService(this.appManager)
    wechatBotIpcMainService.registerIpcMainHandle()
  }
}
