import { DatabaseManager } from './databaseManager'
import { WindowManager } from './windowManager'
import { setupApplicationMenu } from './menu'
import { IpcService } from './ipc'
import { SessionsManager } from './sessionsManager'
import { AgentManager } from './agentManager'

export class AppManager {
  agentManager: AgentManager
  databaseManager: DatabaseManager
  windowManager: WindowManager
  ipcService: IpcService
  sessionsManager: SessionsManager

  constructor() {
    this.agentManager = new AgentManager(this)
    this.databaseManager = new DatabaseManager(this)
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.sessionsManager = new SessionsManager(this)
  }

  init() {
    this.agentManager.init()
    this.databaseManager.init()
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    this.sessionsManager.init()

    setupApplicationMenu()
  }
}
