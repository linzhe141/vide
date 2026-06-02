import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'

export class WorkspaceIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('workspace-get-info', async (data) => {
      return this.appManager.workspaceManager.getWorkspaceInfo(data?.workspacePath ?? null)
    })

    ipcMainApi.handle('workspace-select-directory', async () => {
      return this.appManager.workspaceManager.selectWorkspace()
    })

    ipcMainApi.handle('reveal-path-in-explorer', async ({ path }) => {
      await this.appManager.workspaceManager.revealPath(path)
    })
  }
}
