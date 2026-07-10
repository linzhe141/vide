import { DatabaseManager } from './databaseManager'
import { WindowManager } from './windowManager'
import { setupApplicationMenu } from './menu'
import { IpcService } from './ipc'
import { AgentManager } from './agentManager'
import { WorkspaceManager } from './workspaceManager'
import { UpdaterManager } from './updaterManager'

export class AppManager {
  agentManager: AgentManager
  databaseManager: DatabaseManager
  windowManager: WindowManager
  ipcService: IpcService
  workspaceManager: WorkspaceManager
  updaterManager: UpdaterManager

  constructor() {
    this.agentManager = new AgentManager(this)
    this.databaseManager = new DatabaseManager(this)
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.workspaceManager = new WorkspaceManager(this)
    this.updaterManager = new UpdaterManager(this)
  }

  init() {
    this.agentManager.init()
    this.databaseManager.init()
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    this.workspaceManager.init()
    this.updaterManager.init()

    setupApplicationMenu()
  }
}
