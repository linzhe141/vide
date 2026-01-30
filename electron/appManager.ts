import { WindowManager } from './windowManager'
import { setupApplicationMenu } from './menu'
import { IpcService } from './ipc'
import { DatabaseManager } from './databaseManager'

export class AppManager {
  appManager: AppManager
  windowManager: WindowManager
  ipcService: IpcService
  databaseManager: DatabaseManager

  constructor() {
    this.appManager = this
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.databaseManager = new DatabaseManager(this)
  }

  init() {
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    setupApplicationMenu()

    this.databaseManager.init()
  }
}
