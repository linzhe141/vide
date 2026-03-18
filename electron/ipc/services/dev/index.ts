import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '@/electron/databaseManager'
import {
  askUserQuestions,
  planners,
  threads,
  threadWorkflowBlockMessages,
  threadWorkflowBlocks,
} from '@/db/schema'

export class DevIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('dev-delete-database-rows', async () => {
      await db.delete(threadWorkflowBlockMessages)
      await db.delete(planners)
      await db.delete(askUserQuestions)

      await db.delete(threadWorkflowBlocks)
      await db.delete(threads)
    })
  }
}
