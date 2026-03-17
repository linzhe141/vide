import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import { Agent } from '@/agent/core/agent'
import {
  onAgentEvent,
  onAskUserQuestionEvent,
  onPalnnerEvent,
  onWorkflowEvent,
} from '@/agent/core/apiEvent'
import { logger } from '@/electron/logger'

import type { AgentSession } from '@/agent/core/agentSession'
import {
  agentEventNames,
  askUserQuestionEventNames,
  plannerEventNames,
  workflowEventNames,
} from '@/agent/core/event/channels'
import { db } from '@/electron/databaseManager'
import { threadWorkflowBlocks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import * as schema from '@/db/schema'

export class AgentIpcMainService implements IpcMainService {
  agent: Agent
  session: AgentSession = null!
  constructor(private appManager: AppManager) {
    this.registerIpcMainSenders()
    this.agent = new Agent()
  }

  registerIpcMainHandle() {
    ipcMainApi.handle('agent-create-session', async () => {
      this.session = this.agent.createSession()
      logger.info('agent-create-session ', this.session.sessionId)

      const sessionId = this.session.sessionId
      return sessionId
    })

    ipcMainApi.handle('agent-resume-session', async (data) => {
      const blocks = await db
        .select({ id: threadWorkflowBlocks.id, userInput: threadWorkflowBlocks.input })
        .from(threadWorkflowBlocks)
        .where(eq(threadWorkflowBlocks.threadId, data.sessionId))

      type BlockData = {
        id: string
        userInput: string
        messages: (typeof schema.threadWorkflowBlockMessages.$inferSelect)[]
      }
      const blockMessages: BlockData[] = []

      for (const { id, userInput } of blocks) {
        const blockMessageRows = await db
          .select()
          .from(schema.threadWorkflowBlockMessages)
          .where(eq(schema.threadWorkflowBlockMessages.blockId, id))

        blockMessages.push({
          id,
          userInput,
          messages: blockMessageRows,
        })
      }

      this.agent.resumeSession({
        sessionId: data.sessionId,
        blockData: blockMessages,
      })
      return blockMessages
    })

    ipcMainApi.handle('agent-session-send', async ({ input }) => {
      logger.info('agent-session-send ', input)

      this.session!.run(input)
    })
  }

  // 只是转发到renderer
  registerIpcMainSenders() {
    agentEventNames.forEach((eventName) => {
      onAgentEvent(eventName, (data: any) => {
        console.log('abc', eventName, data)
        ipcMainApi.send(eventName, data)
      })
    })

    plannerEventNames.forEach((eventName) => {
      onPalnnerEvent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })

    askUserQuestionEventNames.forEach((eventName) => {
      onAskUserQuestionEvent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })

    workflowEventNames.forEach((eventName) => {
      onWorkflowEvent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })
  }
}
