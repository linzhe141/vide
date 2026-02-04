import { DatabaseManager } from './databaseManager'
import { WindowManager } from './windowManager'
import { setupApplicationMenu } from './menu'
import { IpcService } from './ipc'
import { ThreadsManager } from './threadsManager'
import { AgentManager } from './agentManager'

export class AppManager {
  appManager: AppManager
  agentManager: AgentManager
  databaseManager: DatabaseManager
  windowManager: WindowManager
  ipcService: IpcService
  threadsManager: ThreadsManager

  constructor() {
    this.appManager = this
    this.agentManager = new AgentManager(this)
    this.databaseManager = new DatabaseManager(this)
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.threadsManager = new ThreadsManager(this)
  }

  init() {
    this.agentManager.init()
    this.databaseManager.init()
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    this.threadsManager.init()

    setupApplicationMenu()
  }
}
