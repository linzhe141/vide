import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '@/electron/databaseManager'
import {
  artifacts,
  askUserQuestions,
  planners,
  sessionBranches,
  sessions,
  sessionWorkflowBlockMessages,
  sessionWorkflowBlocks,
} from '@/db/schema'

export class DevIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('dev-delete-database-rows', async () => {
      await db.delete(sessionWorkflowBlockMessages)
      await db.delete(askUserQuestions)

      await db.delete(sessionBranches)
      await db.delete(sessionWorkflowBlocks)

      await db.delete(planners)
      await db.delete(artifacts)

      await db.delete(sessions)
    })
  }
}
