import { DatabaseManager } from './db/databaseManager'
import { WindowManager } from './modules/windowManager'
import { IpcService } from './ipc'
import { AgentManager } from './modules/agentManager'
import { WorkspaceManager } from './modules/workspaceManager'
import { WechatBotManager } from './modules/wechatBotManager'
import { logger } from './logger'
import electronUpdater from 'electron-updater'
import { app, Menu } from 'electron'
import { ipcMainApi } from './ipc/api/ipcMain'
import type { AppUpdateStatus } from './ipc/api/channels'

let hasInitializedAutoUpdate = false
const PRERELEASE_UPDATE_FEED_URL = 'https://github.com/linzhe141/vide/releases/latest/download'

export class AppManager {
  agentManager: AgentManager
  databaseManager: DatabaseManager
  windowManager: WindowManager
  ipcService: IpcService
  workspaceManager: WorkspaceManager
  wechatBotManager: WechatBotManager
  private updateStatus: AppUpdateStatus

  constructor() {
    this.databaseManager = new DatabaseManager()

    this.agentManager = new AgentManager(this)
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.workspaceManager = new WorkspaceManager(this)
    this.wechatBotManager = new WechatBotManager(this)
    this.updateStatus = this.createInitialUpdateStatus()
  }

  init() {
    this.databaseManager.init()

    this.agentManager.init()
    this.windowManager.init()
    this.ipcService.registerIpcMainHandle()
    this.workspaceManager.init()
    this.wechatBotManager.init()

    this.setupApplicationMenu()
    this.autoUpdate()
  }

  setupApplicationMenu() {
    Menu.setApplicationMenu(Menu.buildFromTemplate([]))
  }

  getUpdateStatus() {
    return this.updateStatus
  }

  async checkForUpdates() {
    if (!app.isPackaged) {
      this.setUpdateStatus({
        phase: 'idle',
        message: 'Update checks are only available in packaged builds.',
        latestVersion: null,
        downloadProgress: null,
      })
      return this.updateStatus
    }

    const { autoUpdater } = electronUpdater
    this.setUpdateStatus({
      phase: 'checking',
      message: 'Checking for updates...',
      latestVersion: null,
      downloadProgress: null,
    })

    try {
      await autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('check update failed', error)
      this.setUpdateStatus({
        phase: 'error',
        message,
        downloadProgress: null,
      })
    }

    return this.updateStatus
  }

  installUpdateAndRestart() {
    const { autoUpdater } = electronUpdater
    if (this.updateStatus.phase !== 'downloaded') return
    autoUpdater.quitAndInstall(true, true)
  }

  autoUpdate() {
    if (hasInitializedAutoUpdate) return
    hasInitializedAutoUpdate = true

    const { autoUpdater } = electronUpdater
    autoUpdater.logger = logger
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = app.getVersion().includes('-')
    if (autoUpdater.allowPrerelease) {
      autoUpdater.setFeedURL(PRERELEASE_UPDATE_FEED_URL)
      logger.info('autoUpdater using latest-release generic feed for prerelease builds', {
        feedUrl: PRERELEASE_UPDATE_FEED_URL,
        currentVersion: app.getVersion(),
      })
    }

    autoUpdater.on('checking-for-update', () => {
      this.setUpdateStatus({
        phase: 'checking',
        message: 'Checking for updates...',
        latestVersion: null,
        downloadProgress: null,
      })
    })
    autoUpdater.on('error', (error) => {
      logger.error('autoUpdater error', error)
      this.setUpdateStatus({
        phase: 'error',
        message: error.message,
        downloadProgress: null,
      })
    })
    autoUpdater.on('update-available', (info) => {
      logger.info('update available', info)
      this.setUpdateStatus({
        phase: 'available',
        message: `Update ${info.version} found. Downloading in the background...`,
        latestVersion: info.version,
        downloadProgress: null,
      })
    })
    autoUpdater.on('download-progress', (info) => {
      this.setUpdateStatus({
        phase: 'downloading',
        message: `Downloading update ${Math.round(info.percent)}%`,
        downloadProgress: info.percent,
      })
    })
    autoUpdater.on('update-not-available', (info) => {
      logger.info('update not available', info)
      this.setUpdateStatus({
        phase: 'not-available',
        message: 'You are already on the latest version.',
        latestVersion: info.version ?? app.getVersion(),
        downloadProgress: null,
      })
    })
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('update downloaded', info)
      this.setUpdateStatus({
        phase: 'downloaded',
        message: `Update ${info.version} is ready. Restart the app to install it.`,
        latestVersion: info.version,
        downloadProgress: 100,
      })
    })

    if (!app.isPackaged) {
      this.setUpdateStatus({
        phase: 'idle',
        message: 'Update checks are only available in packaged builds.',
        latestVersion: null,
        downloadProgress: null,
      })
      return
    }

    void this.checkForUpdates()
  }

  private createInitialUpdateStatus(): AppUpdateStatus {
    return {
      phase: 'idle',
      message: app.isPackaged
        ? 'Automatic update checks run in the background after launch.'
        : 'Update checks are only available in packaged builds.',
      currentVersion: app.getVersion(),
      latestVersion: null,
      downloadProgress: null,
      isPackaged: app.isPackaged,
      allowPrerelease: app.getVersion().includes('-'),
    }
  }

  private setUpdateStatus(status: Partial<AppUpdateStatus>) {
    this.updateStatus = {
      ...this.updateStatus,
      ...status,
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      allowPrerelease: app.getVersion().includes('-'),
    }
    ipcMainApi.send('app-update-status', this.updateStatus)
  }
}
