import type { AppManager } from '../../..//appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '../../..//databaseManager'
import {
  artifacts,
  askUserQuestions,
  planners,
  sessionBranches,
  sessions,
  sessionWorkflowMessages,
  sessionWorkflows,
} from '../../../db/schema'

export class DevIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('dev-delete-database-rows', async () => {
      await this.appManager.databaseManager.execute('PRAGMA foreign_keys = OFF', [], 'run')
      try {
        await db.delete(sessionWorkflowMessages)
        await db.delete(askUserQuestions)

        await db.delete(sessionBranches)
        await db.delete(sessionWorkflows)

        await db.delete(planners)
        await db.delete(artifacts)

        await db.delete(sessions)
      } finally {
        await this.appManager.databaseManager.execute('PRAGMA foreign_keys = ON', [], 'run')
      }
    })
  }
}
