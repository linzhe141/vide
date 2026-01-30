import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { db } from '@/electron/databaseManager'
import { threadMessages, threads } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'

export class ThreadIpcMainService implements IpcMainService {
  constructor(private appManager: AppManager) {}

  registerIpcMainHandle() {
    ipcMainApi.handle('threads-list', () => {
      return db.select().from(threads).orderBy(desc(threads.createdAt))
    })

    ipcMainApi.handle('threads-item-messages', ({ threadId }) => {
      return db.select().from(threadMessages).where(eq(threadMessages.threadId, threadId))
    })
  }

  // TODO 迁移 AgentIpcMainService 的 持久化 thread 逻辑
  // 丰富 channel 参数 至少每个channel 都存在 threadId
  setupAgentEvents() {}
}
