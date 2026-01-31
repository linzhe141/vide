import { DatabaseManager } from './databaseManager'
import { WindowManager } from './windowManager'
import { setupApplicationMenu } from './menu'
import { IpcService } from './ipc'
import { ThreadsManager } from './threadsManager'

export class AppManager {
  appManager: AppManager
  databaseManager: DatabaseManager
  windowManager: WindowManager
  ipcService: IpcService
  threadsManager: ThreadsManager

  constructor() {
    this.appManager = this
    this.databaseManager = new DatabaseManager(this)
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.threadsManager = new ThreadsManager(this)
  }

  init() {
    this.databaseManager.init()
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    this.threadsManager.init()

    setupApplicationMenu()
  }
}
