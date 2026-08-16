import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '../../api/ipcMain'
import {
  getWorkspaceFileContent,
  getWorkspaceFiles,
  WorkspaceExplorerWatchRegistry,
} from './explorer'

export class WorkspaceIpcMainService implements IpcMainService {
  private workspaceExplorerWatchRegistry = new WorkspaceExplorerWatchRegistry((data) => {
    ipcMainApi.send('workspace-file-changed', data)
  })

  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('workspace-get-info', async (data) => {
      return this.appManager.workspaceManager.getWorkspaceInfo(data?.workspacePath ?? null)
    })

    ipcMainApi.handle('workspace-select-directory', async () => {
      return this.appManager.workspaceManager.selectWorkspace()
    })

    ipcMainApi.handle('get-workspace-files', async ({ workspacePath, target }) => {
      return getWorkspaceFiles({ workspacePath, target })
    })

    ipcMainApi.handle(
      'get-workspace-file-content',
      async ({ workspacePath, target, maxBytes }) => {
        return getWorkspaceFileContent({
          workspacePath,
          target,
          maxBytes,
        })
      }
    )

    ipcMainApi.handle('workspace-files-watch-start', async ({ workspacePath }) => {
      await this.workspaceExplorerWatchRegistry.start(workspacePath)
    })

    ipcMainApi.handle('workspace-files-watch-stop', async ({ workspacePath }) => {
      await this.workspaceExplorerWatchRegistry.stop(workspacePath)
    })

    ipcMainApi.handle('reveal-path-in-explorer', async ({ path }) => {
      await this.appManager.workspaceManager.revealPath(path)
    })
  }
}
