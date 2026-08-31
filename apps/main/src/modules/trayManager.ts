import { Menu, Tray, nativeImage } from 'electron'
import type { AppManager } from '@/appManager'
import { logger } from '@/logger'
import { resolveRuntimeResourcePath } from '@/utils'

const iconPath = resolveRuntimeResourcePath('logo.png')

export class TrayManager {
  private tray: Tray | null = null
  private hasShownCloseHint = false

  constructor(private app: AppManager) {}

  init() {
    if (this.tray) return

    const trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
      logger.error('tray icon failed to load', { iconPath })
      return
    }
    this.tray = new Tray(trayIcon)
    this.tray.setToolTip('vide')
    this.tray.setContextMenu(this.buildContextMenu())
    this.tray.on('click', () => {
      this.app.windowManager.showWindow()
    })
  }

  dispose() {
    this.tray?.destroy()
    this.tray = null
  }

  showCloseToTrayMessage() {
    if (this.hasShownCloseHint || !this.tray) return

    this.hasShownCloseHint = true

    if (process.platform === 'win32') {
      this.tray.displayBalloon({
        title: 'vide',
        content: '应用已最小化到系统托盘，可通过托盘图标重新打开。',
      })
    }
  }

  private buildContextMenu() {
    return Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          this.app.windowManager.showWindow()
        },
      },
      {
        label: '打开渲染 DevTools',
        click: () => {
          this.app.windowManager.openMainWindowDevTools()
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.app.windowManager.requestAppQuit().catch((error) => {
            logger.error('failed to quit app from tray', error)
          })
        },
      },
    ])
  }
}
