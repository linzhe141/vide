import { WindowManager } from './windowManager'
import { setupApplicationMenu } from './menu'
import { IpcService } from './ipc'

export class AppManager {
  appManager: AppManager
  windowManager: WindowManager
  ipcService: IpcService

  constructor() {
    this.appManager = this
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
  }

  init() {
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    setupApplicationMenu()
  }
}
