import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '@/electron/databaseManager'
import { threads } from '@/db/schema'
import { desc } from 'drizzle-orm'
import type { ThreadMessageRowDto, ThreadRowDto } from '../../api/channels'

export class ThreadIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('get-threads-list', async () => {
      const rows = await db.select().from(threads).orderBy(desc(threads.createdAt))
      return rows as ThreadRowDto[]
    })

    ipcMainApi.handle('get-threads-item-messages', async () => {
      // const rows = await db
      //   .select()
      //   .from(threadWorkflowBlockMessages)
      //   .where(eq(threadWorkflowBlockMessages.threadId, sessionId))
      return [] as ThreadMessageRowDto[]
    })
  }
}
