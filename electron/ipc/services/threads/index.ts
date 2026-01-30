import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '@/electron/databaseManager'
import { threadMessages, threads } from '@/db/schema'
import { eq } from 'drizzle-orm'

export class ThreadIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('threads-list', () => {
      return db.select().from(threads)
    })

    ipcMainApi.handle('threads-item-messages', ({ threadId }) => {
      return db.select().from(threadMessages).where(eq(threadMessages.threadId, threadId))
    })
  }
}
