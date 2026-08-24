import { BrowserWindow, app } from 'electron'
import electronUpdater from 'electron-updater'
import type { AppUpdateStatus } from '@/ipc/api/channels'
import { ipcMainApi } from '@/ipc/api/ipcMain'
import { logger } from '@/logger'

const AUTO_CHECK_DELAY_MS = 60_000
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60_000
const PRERELEASE_UPDATE_FEED_URL = 'https://github.com/linzhe141/vide/releases/latest/download'

type UpdaterRuntimeState = {
  initialized: boolean
  checking: boolean
  downloading: boolean
  updateAvailable: boolean
  installLaterVersion: string | null
  autoCheckTimer: NodeJS.Timeout | null
  autoCheckInterval: NodeJS.Timeout | null
  resetTimer: NodeJS.Timeout | null
  status: AppUpdateStatus | null
}

const runtimeState: UpdaterRuntimeState = {
  initialized: false,
  checking: false,
  downloading: false,
  updateAvailable: false,
  installLaterVersion: null,
  autoCheckTimer: null,
  autoCheckInterval: null,
  resetTimer: null,
  status: null,
}

export class UpdaterManager {
  constructor() {
    runtimeState.status ??= this.createInitialStatus()
  }

  initialize() {
    if (runtimeState.initialized) {
      this.broadcastStatus()
      return
    }

    runtimeState.initialized = true

    const { autoUpdater } = electronUpdater
    autoUpdater.logger = logger
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowPrerelease = this.allowPrerelease()

    this.configureProvider()
    this.registerEvents()

    if (!app.isPackaged) {
      this.setStatus({
        phase: 'idle',
        message: 'Update checks are only available in packaged builds.',
        latestVersion: null,
        downloadProgress: null,
        errorMessage: null,
        updateAvailable: false,
        willInstallOnQuit: false,
      })
      return
    }

    this.scheduleAutoChecks()
    this.broadcastStatus()
  }

  dispose() {
    if (runtimeState.autoCheckTimer) {
      clearTimeout(runtimeState.autoCheckTimer)
      runtimeState.autoCheckTimer = null
    }
    if (runtimeState.autoCheckInterval) {
      clearInterval(runtimeState.autoCheckInterval)
      runtimeState.autoCheckInterval = null
    }
    if (runtimeState.resetTimer) {
      clearTimeout(runtimeState.resetTimer)
      runtimeState.resetTimer = null
    }
  }

  getUpdateStatus() {
    return runtimeState.status ?? this.createInitialStatus()
  }

  async checkForUpdates(options: { manual?: boolean } = {}) {
    const { manual = false } = options
    if (!app.isPackaged) {
      this.setStatus({
        phase: 'idle',
        message: 'Update checks are only available in packaged builds.',
        latestVersion: null,
        downloadProgress: null,
        errorMessage: null,
        updateAvailable: false,
        willInstallOnQuit: false,
      })
      return this.getUpdateStatus()
    }

    if (
      runtimeState.checking ||
      runtimeState.downloading ||
      this.getUpdateStatus().phase === 'downloaded'
    ) {
      return this.getUpdateStatus()
    }

    runtimeState.checking = true
    const { autoUpdater } = electronUpdater
    autoUpdater.allowPrerelease = this.allowPrerelease()
    this.configureProvider()

    this.setStatus({
      phase: 'checking',
      message: manual ? 'Checking for updates...' : 'Checking for updates in the background...',
      latestVersion: this.getUpdateStatus().latestVersion,
      downloadProgress: null,
      errorMessage: null,
      updateAvailable: runtimeState.updateAvailable,
      willInstallOnQuit: false,
    })

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (this.isMissingUpdateManifestError(error)) {
        logger.warn('update manifest not ready yet, treating as no update', message)
        this.setStatus({
          phase: 'not-available',
          message: 'You are already on the latest version.',
          latestVersion: app.getVersion(),
          downloadProgress: null,
          errorMessage: null,
          updateAvailable: false,
          willInstallOnQuit: false,
        })
        this.scheduleIdleReset('not-available', 5000)
        return this.getUpdateStatus()
      }

      logger.error('check update failed', error)
      this.setStatus({
        phase: 'error',
        message,
        downloadProgress: null,
        errorMessage: message,
        updateAvailable: false,
      })
      this.scheduleIdleReset('error', 3000)
    } finally {
      runtimeState.checking = false
    }

    return this.getUpdateStatus()
  }

  async downloadUpdate() {
    if (runtimeState.downloading || !runtimeState.updateAvailable) {
      return this.getUpdateStatus()
    }

    const { autoUpdater } = electronUpdater
    runtimeState.downloading = true
    this.setStatus({
      phase: 'downloading',
      message: 'Downloading update...',
      errorMessage: null,
      willInstallOnQuit: false,
    })

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      runtimeState.downloading = false
      logger.error('download update failed', error)
      this.setStatus({
        phase: 'error',
        message,
        downloadProgress: null,
        errorMessage: message,
        updateAvailable: runtimeState.updateAvailable,
        willInstallOnQuit: false,
      })
      this.scheduleIdleReset('error', 3000)
    }

    return this.getUpdateStatus()
  }

  installUpdateAndRestart() {
    if (this.getUpdateStatus().phase !== 'downloaded') return

    const { autoUpdater } = electronUpdater
    logger.info('Installing update now...')

    if (process.platform !== 'win32') {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.close()
        }
      }
    }

    app.releaseSingleInstanceLock()

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true)
    }, 100)
  }

  installUpdateLater() {
    if (this.getUpdateStatus().phase !== 'downloaded') return this.getUpdateStatus()

    const { autoUpdater } = electronUpdater
    autoUpdater.autoInstallOnAppQuit = true
    runtimeState.installLaterVersion = this.getUpdateStatus().latestVersion

    this.setStatus({
      phase: 'downloaded',
      message: runtimeState.installLaterVersion
        ? `Update ${runtimeState.installLaterVersion} will install on next restart.`
        : 'The downloaded update will install on next restart.',
      willInstallOnQuit: true,
    })

    return this.getUpdateStatus()
  }

  private registerEvents() {
    const { autoUpdater } = electronUpdater

    autoUpdater.on('checking-for-update', () => {
      logger.info('checking for updates...')
    })

    autoUpdater.on('update-available', (info) => {
      logger.info('update available', info)
      runtimeState.updateAvailable = true

      this.setStatus({
        phase: 'available',
        message: `Update ${info.version} found. Downloading in the background...`,
        latestVersion: info.version,
        downloadProgress: null,
        errorMessage: null,
        updateAvailable: true,
        willInstallOnQuit: false,
      })

      void this.downloadUpdate()
    })

    autoUpdater.on('update-not-available', (info) => {
      logger.info('update not available', info)
      runtimeState.updateAvailable = false
      runtimeState.downloading = false

      this.setStatus({
        phase: 'not-available',
        message: 'You are already on the latest version.',
        latestVersion: info.version ?? app.getVersion(),
        downloadProgress: null,
        errorMessage: null,
        updateAvailable: false,
        willInstallOnQuit: false,
      })
      this.scheduleIdleReset('not-available', 5000)
    })

    autoUpdater.on('download-progress', (info) => {
      this.setStatus({
        phase: 'downloading',
        message: `Downloading update ${Math.round(info.percent)}%`,
        downloadProgress: info.percent,
        errorMessage: null,
        updateAvailable: true,
        willInstallOnQuit: false,
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('update downloaded', info)
      runtimeState.downloading = false
      runtimeState.updateAvailable = true

      const willInstallOnQuit = runtimeState.installLaterVersion === info.version
      this.setStatus({
        phase: 'downloaded',
        message: willInstallOnQuit
          ? `Update ${info.version} will install on next restart.`
          : `Update ${info.version} is ready. Restart now or install on next quit.`,
        latestVersion: info.version,
        downloadProgress: 100,
        errorMessage: null,
        updateAvailable: true,
        willInstallOnQuit,
      })
    })

    autoUpdater.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error)

      if (this.isMissingUpdateManifestError(error)) {
        logger.warn('update manifest not ready yet, skipping updater error', message)
        runtimeState.checking = false
        runtimeState.downloading = false
        runtimeState.updateAvailable = false
        this.setStatus({
          phase: 'not-available',
          message: 'You are already on the latest version.',
          latestVersion: app.getVersion(),
          downloadProgress: null,
          errorMessage: null,
          updateAvailable: false,
          willInstallOnQuit: false,
        })
        this.scheduleIdleReset('not-available', 5000)
        return
      }

      runtimeState.checking = false
      runtimeState.downloading = false
      logger.error('autoUpdater error', error)
      this.setStatus({
        phase: 'error',
        message,
        downloadProgress: null,
        errorMessage: message,
        updateAvailable: runtimeState.updateAvailable,
      })
      this.scheduleIdleReset('error', 3000)
    })
  }

  private configureProvider() {
    const { autoUpdater } = electronUpdater

    if (this.allowPrerelease()) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: PRERELEASE_UPDATE_FEED_URL,
      })
      logger.info('autoUpdater using prerelease generic feed', {
        feedUrl: PRERELEASE_UPDATE_FEED_URL,
        currentVersion: app.getVersion(),
      })
      return
    }

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'linzhe141',
      repo: 'vide',
      vPrefixedTagName: true,
      releaseType: 'release',
    })
    logger.info('autoUpdater using GitHub release feed', {
      owner: 'linzhe141',
      repo: 'vide',
      currentVersion: app.getVersion(),
    })
  }

  private scheduleAutoChecks() {
    if (runtimeState.autoCheckTimer || runtimeState.autoCheckInterval) return

    runtimeState.autoCheckTimer = setTimeout(() => {
      void this.checkForUpdates()
    }, AUTO_CHECK_DELAY_MS)

    runtimeState.autoCheckInterval = setInterval(() => {
      void this.checkForUpdates()
    }, AUTO_CHECK_INTERVAL_MS)
  }

  private scheduleIdleReset(expectedPhase: AppUpdateStatus['phase'], delayMs: number) {
    if (runtimeState.resetTimer) {
      clearTimeout(runtimeState.resetTimer)
    }

    runtimeState.resetTimer = setTimeout(() => {
      if (this.getUpdateStatus().phase !== expectedPhase) return
      this.setStatus({
        phase: 'idle',
        message: app.isPackaged
          ? 'Automatic update checks will continue in the background.'
          : 'Update checks are only available in packaged builds.',
        downloadProgress: null,
        errorMessage: null,
      })
    }, delayMs)
  }

  private createInitialStatus(): AppUpdateStatus {
    return {
      phase: 'idle',
      message: app.isPackaged
        ? 'Automatic update checks will start in the background after launch.'
        : 'Update checks are only available in packaged builds.',
      currentVersion: app.getVersion(),
      latestVersion: null,
      downloadProgress: null,
      isPackaged: app.isPackaged,
      allowPrerelease: this.allowPrerelease(),
      updateAvailable: false,
      errorMessage: null,
      willInstallOnQuit: false,
    }
  }

  private setStatus(status: Partial<AppUpdateStatus>) {
    runtimeState.status = {
      ...(runtimeState.status ?? this.createInitialStatus()),
      ...status,
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      allowPrerelease: this.allowPrerelease(),
      updateAvailable:
        status.updateAvailable ??
        runtimeState.status?.updateAvailable ??
        runtimeState.updateAvailable,
      willInstallOnQuit:
        status.willInstallOnQuit ?? runtimeState.status?.willInstallOnQuit ?? false,
    }

    ipcMainApi.send('app-update-status', runtimeState.status)
  }

  private broadcastStatus() {
    ipcMainApi.send('app-update-status', this.getUpdateStatus())
  }

  private allowPrerelease() {
    return app.getVersion().includes('-')
  }

  private isMissingUpdateManifestError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    if (!message) return false
    if (!/cannot find/i.test(message)) return false
    if (!/\b404\b/.test(message)) return false
    return /\b(?:latest|stable|nightly|canary)(?:-[\da-z]+)?\.yml\b/i.test(message)
  }
}
