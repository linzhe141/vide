import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '../../api/ipcMain'
import { readWorkspacePreview, readWorkspaceTree, WorkspaceExplorerWatchRegistry } from './explorer'

export class WorkspaceIpcMainService implements IpcMainService {
  private workspaceExplorerWatchRegistry = new WorkspaceExplorerWatchRegistry((data) => {
    ipcMainApi.send('workspace-explorer-changed', data)
  })

  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('workspace-get-info', async (data) => {
      return this.appManager.workspaceManager.getWorkspaceInfo(data?.workspacePath ?? null)
    })

    ipcMainApi.handle('workspace-select-directory', async () => {
      return this.appManager.workspaceManager.selectWorkspace()
    })

    ipcMainApi.handle('workspace-explorer-read-tree', async ({ workspacePath }) => {
      return readWorkspaceTree(workspacePath)
    })

    ipcMainApi.handle(
      'workspace-explorer-read-file',
      async ({ workspacePath, targetPath, maxBytes }) => {
        return readWorkspacePreview({
          workspacePath,
          targetPath,
          maxBytes,
        })
      }
    )

    ipcMainApi.handle('workspace-explorer-watch-start', async ({ workspacePath }) => {
      await this.workspaceExplorerWatchRegistry.start(workspacePath)
    })

    ipcMainApi.handle('workspace-explorer-watch-stop', async ({ workspacePath }) => {
      await this.workspaceExplorerWatchRegistry.stop(workspacePath)
    })

    ipcMainApi.handle(
      'workspace-explorer-sync-directory',
      async ({ workspacePath, targetPath }) => {
        return this.workspaceExplorerWatchRegistry.syncDirectory(workspacePath, targetPath)
      }
    )

    ipcMainApi.handle('reveal-path-in-explorer', async ({ path }) => {
      await this.appManager.workspaceManager.revealPath(path)
    })
  }
}
