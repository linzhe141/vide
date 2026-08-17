import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '@/db/databaseManager'
import {
  sessionBranches,
  sessions,
  sessionWorkflows,
  workflowLogs,
  workflowMessages,
} from '@/db/schema'

export class DevIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('dev-delete-database-rows', async () => {
      // 按外键依赖顺序删除（先子表后父表），清空所有 session 持久化数据
      await db.delete(workflowLogs)
      await db.delete(workflowMessages)
      await db.delete(sessionBranches)
      await db.delete(sessionWorkflows)
      await db.delete(sessions)
    })
  }
}
