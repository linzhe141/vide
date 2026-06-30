import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { AppManager } from './appManager'
import { logger } from './logger'

const { autoUpdater } = electronUpdater
export class UpdaterManager {
  constructor(private app: AppManager) {}

  init() {
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
