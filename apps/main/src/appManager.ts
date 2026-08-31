import { DatabaseManager } from './db/databaseManager'
import { WindowManager } from './modules/windowManager'
import { IpcService } from './ipc'
import { AgentManager } from './modules/agentManager'
import { WorkspaceManager } from './modules/workspaceManager'
import { WechatBotManager } from './modules/wechatBotManager'
import { UpdaterManager } from './modules/updaterManager'
import { GitHubAuthManager } from './modules/githubAuthManager'
import { TrayManager } from './modules/trayManager'
import { logger, logStartupStep } from './logger'
import { LocalServerManager } from '@/modules/localServerManager'
import { RendererEventBridge } from '@/modules/rendererEventBridge'
import { Menu } from 'electron'

export class AppManager {
  agentManager: AgentManager
  databaseManager: DatabaseManager
  windowManager: WindowManager
  ipcService: IpcService
  workspaceManager: WorkspaceManager
  wechatBotManager: WechatBotManager
  updaterManager: UpdaterManager
  githubAuthManager: GitHubAuthManager
  localServerManager: LocalServerManager
  rendererEventBridge: RendererEventBridge
  trayManager: TrayManager

  constructor() {
    this.databaseManager = new DatabaseManager()

    this.githubAuthManager = new GitHubAuthManager()
    this.localServerManager = new LocalServerManager({
      callbackUrl: this.githubAuthManager.getCallbackUrl(),
    })
    this.localServerManager.registerRoute(
      this.githubAuthManager.getCallbackPath(),
      (callbackUrl: URL) => this.githubAuthManager.handleLocalCallback(callbackUrl)
    )
    this.githubAuthManager.attachLocalServerManager(this.localServerManager)

    this.rendererEventBridge = new RendererEventBridge()
    this.agentManager = new AgentManager(this)
    this.windowManager = new WindowManager(this)
    this.ipcService = new IpcService(this)
    this.workspaceManager = new WorkspaceManager(this)
    this.wechatBotManager = new WechatBotManager(this)
    this.updaterManager = new UpdaterManager()
    this.trayManager = new TrayManager(this)
  }

  async init() {
    logStartupStep('appManager.init.start')
    this.databaseManager.init()
    logStartupStep('database.init.complete')
    await this.rendererEventBridge.init()
    logStartupStep('rendererEventBridge.init.complete')

    this.localServerManager
      .init()
      .then(() => {
        logStartupStep('localServerManager.init.complete')
      })
      .catch((error) => {
        logger.error('failed to start local server manager during app init', error)
      })

    this.agentManager.init()
    logStartupStep('agentManager.init.complete')
    this.windowManager.init()
    logStartupStep('windowManager.init.complete')
    this.trayManager.init()
    logStartupStep('trayManager.init.complete')
    this.ipcService.registerIpcMainHandle()
    logStartupStep('ipcService.register.complete')
    this.workspaceManager.init()
    logStartupStep('workspaceManager.init.complete')
    this.wechatBotManager.init()
    logStartupStep('wechatBotManager.init.complete')

    this.setupApplicationMenu()
    logStartupStep('applicationMenu.init.complete')
    this.updaterManager.initialize()
    logStartupStep('updaterManager.initialize.dispatched')
    logStartupStep('appManager.init.complete')
  }

  setupApplicationMenu() {
    Menu.setApplicationMenu(Menu.buildFromTemplate([]))
  }

  getUpdateStatus() {
    return this.updaterManager.getUpdateStatus()
  }

  async checkForUpdates() {
    return this.updaterManager.checkForUpdates({ manual: true })
  }

  installUpdateAndRestart() {
    this.updaterManager.installUpdateAndRestart()
  }

  installUpdateLater() {
    return this.updaterManager.installUpdateLater()
  }

  async handleProtocolUrl(url: string) {
    const handled = await this.githubAuthManager.handleProtocolUrl(url)
    if (!handled) {
      logger.warn('unhandled protocol url', url)
    }
  }

  async dispose() {
    this.trayManager.dispose()
    this.updaterManager.dispose()
    await this.rendererEventBridge.dispose()
    await this.localServerManager.dispose()
    await this.githubAuthManager.dispose()
    await this.wechatBotManager.dispose()
  }
}
