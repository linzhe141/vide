import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '../../api/ipcMain'
import { SessionRepository } from '@/modules/sessionRepository'
import type { SessionRowDto } from '../../api/channels'
import { scanSkills } from '@vide/agent'

export class SessionIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('get-sessions-list', async () => {
      const rows = await SessionRepository.listSessions()
      return rows.map(
        (row) =>
          ({
            id: row.id,
            title: row.title ?? '',
            type: row.type,
            originSessionId: row.originSessionId,
            originWorkflowId: row.originWorkflowId,
            workspacePath: row.workspacePath,
            autoApprove: row.autoApprove,
            thinkingMode: row.thinkingMode,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }) satisfies SessionRowDto
      )
    })

    ipcMainApi.handle('get-skills-list', async () => {
      return scanSkills()
    })
  }
}
