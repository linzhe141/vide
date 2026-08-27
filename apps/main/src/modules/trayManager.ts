import path from 'node:path'
import { Menu, Tray, dialog, nativeImage } from 'electron'
import type { AppManager } from '@/appManager'
import { logger } from '@/logger'

const iconPath = path.resolve(__dirname, '../../../../../resources/logo.png')

export class TrayManager {
  private tray: Tray | null = null
  private hasShownCloseHint = false

  constructor(private app: AppManager) {}

  init() {
    if (this.tray) return

    const trayIcon = nativeImage.createFromPath(iconPath)
    this.tray = new Tray(trayIcon.isEmpty() ? iconPath : trayIcon)
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
        label: 'Hello World',
        click: () => {
          this.handleHelloWorldClick().catch((error) => {
            logger.error('failed to show tray hello world dialog', error)
          })
        },
      },
      {
        label: '显示主窗口',
        click: () => {
          this.app.windowManager.showWindow()
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

  private async handleHelloWorldClick() {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Hello World',
      message: 'Hello World',
      detail: '托盘菜单已经接通，可以在这里继续扩展右键功能。',
      buttons: ['确定'],
      noLink: true,
    })
  }
}
