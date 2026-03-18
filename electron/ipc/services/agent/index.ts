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
import type { BlockData } from '../../api/channels'
import type { AskUserQuestionDraft } from '@/agent/core/tools/askUserQuestion'
import type { PlanStep } from '@/agent/core/tools/planner'

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

      const blockData: BlockData[] = []

      for (const { id, userInput } of blocks) {
        const blockMessageRows = await db
          .select()
          .from(schema.threadWorkflowBlockMessages)
          .where(eq(schema.threadWorkflowBlockMessages.blockId, id))
        const askUserQuestionRows = await db
          .select()
          .from(schema.askUserQuestions)
          .where(eq(schema.askUserQuestions.blockId, id))
        const askUserQuestion = askUserQuestionRows[0]
        const draft = JSON.parse(askUserQuestion?.draftJson || '{}') as AskUserQuestionDraft

        const plannerRows = await db
          .select()
          .from(schema.planners)
          .where(eq(schema.planners.blockId, id))
        const plannerTarget = plannerRows[0]
        const planner = JSON.parse(plannerTarget?.planJson || '[]') as PlanStep[]

        const prevBlockPlaner = blockData.at(-1)?.planner
        blockData.push({
          id,
          userInput,
          messages: blockMessageRows,
          planner: planner.length
            ? {
                steps: planner,
              }
            : prevBlockPlaner?.steps.length
              ? prevBlockPlaner
              : undefined,
          askUser: askUserQuestion
            ? {
                completed: askUserQuestion.completedGenerate === 'true',
                submitValue: JSON.parse(askUserQuestion.answerJson || '[]'),
                title: draft.title || '',
                description: draft.description || '',
                type: draft.type || 'single',
                options: draft.options,
              }
            : undefined,
        })
      }

      this.session = this.agent.resumeSession({
        sessionId: data.sessionId,
        blockData: blockData,
      })
      return blockData
    })

    ipcMainApi.handle('agent-session-send', async ({ input }) => {
      logger.info('agent-session-send ', input)

      this.session!.run(input)
    })

    ipcMainApi.handle('ask-user-question-submit', async (data) => {
      console.log('xxxxxxxxxxxxxxxxxx')
      await db
        .update(schema.askUserQuestions)
        .set({
          answerJson: JSON.stringify(data.submitValue),
        })
        .where(eq(schema.askUserQuestions.blockId, data.workflowId))
      console.log('yyyyyyyyyy')
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
