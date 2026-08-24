import { DatabaseManager } from './db/databaseManager'
import { WindowManager } from './modules/windowManager'
import { IpcService } from './ipc'
import { AgentManager } from './modules/agentManager'
import { WorkspaceManager } from './modules/workspaceManager'
import { WechatBotManager } from './modules/wechatBotManager'
import { UpdaterManager } from './modules/updaterManager'
import { logger } from './logger'
import { Menu } from 'electron'

export class AppManager {
  agentManager: AgentManager
  databaseManager: DatabaseManager
  windowManager: WindowManager
  ipcService: IpcService
  workspaceManager: WorkspaceManager
  wechatBotManager: WechatBotManager
  updaterManager: UpdaterManager

  constructor() {
    this.databaseManager = new DatabaseManager()

    this.agentManager = new AgentManager(this)
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.workspaceManager = new WorkspaceManager(this)
    this.wechatBotManager = new WechatBotManager(this)
    this.updaterManager = new UpdaterManager()
  }

  init() {
    this.databaseManager.init()

    this.agentManager.init()
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    this.workspaceManager.init()
    this.wechatBotManager.init()

    this.setupApplicationMenu()
    this.updaterManager.initialize()
  }

  setupApplicationMenu() {
    Menu.setApplicationMenu(Menu.buildFromTemplate([]))
  }

  getUpdateStatus() {
    return this.updaterManager.getUpdateStatus()
  }

  async checkForUpdates() {
    return this.updaterManager.checkForUpdates({ manual: true })
  }

  installUpdateAndRestart() {
    this.updaterManager.installUpdateAndRestart()
  }

  installUpdateLater() {
    return this.updaterManager.installUpdateLater()
  }

  async dispose() {
    this.updaterManager.dispose()
    await this.wechatBotManager.dispose()
  }
}
