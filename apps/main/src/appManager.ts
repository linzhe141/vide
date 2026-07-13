import { DatabaseManager } from './db/databaseManager'
import { WindowManager } from './modules/windowManager'
import { IpcService } from './ipc'
import { AgentManager } from './modules/agentManager'
import { WorkspaceManager } from './modules/workspaceManager'
import { logger } from './logger'
import electronUpdater from 'electron-updater'
import { app, Menu } from 'electron'

export class AppManager {
  agentManager: AgentManager
  databaseManager: DatabaseManager
  windowManager: WindowManager
  ipcService: IpcService
  workspaceManager: WorkspaceManager

  constructor() {
    this.databaseManager = new DatabaseManager()

    this.agentManager = new AgentManager(this)
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.workspaceManager = new WorkspaceManager(this)
  }

  init() {
    this.databaseManager.init()

    this.agentManager.init()
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    this.workspaceManager.init()

    this.setupApplicationMenu()
    this.autoUpdate()
  }

  setupApplicationMenu() {
    Menu.setApplicationMenu(Menu.buildFromTemplate([]))
  }

  autoUpdate() {
    const { autoUpdater } = electronUpdater
    autoUpdater.logger = logger
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('error', (error) => logger.error('autoUpdater error', error))
    autoUpdater.on('update-available', (info) => logger.info('update available', info))
    autoUpdater.on('update-not-available', (info) => logger.info('update not available', info))
    autoUpdater.on('update-downloaded', (info) => logger.info('update downloaded', info))

    if (!app.isPackaged) return
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      logger.error('check update failed', error)
    })
  }
}
