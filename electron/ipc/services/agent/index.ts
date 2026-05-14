import { asc, eq } from 'drizzle-orm'
import { Agent } from '@/agent/core/agent'
import { onAgentEvent, onPalnnerEvent, onWorkflowEvent } from '@/agent/core/apiEvent'
import { agentEventNames, plannerEventNames, workflowEventNames } from '@/agent/core/event/channels'
import type { Session } from '@/agent/core/session'
import type { PlanStep } from '@/agent/core/tools/planner'
import * as schema from '@/db/schema'
import { db } from '@/electron/databaseManager'
import { logger } from '@/electron/logger'
import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import type { BlockData } from '../../api/channels'
import { ipcMainApi } from '../../api/ipcMain'

export class AgentIpcMainService implements IpcMainService {
  agent: Agent
  session: Session = null!

  constructor(private appManager: AppManager) {
    this.registerIpcMainSenders()
    this.agent = new Agent()
  }

  registerIpcMainHandle() {
    ipcMainApi.handle('agent-create-session', async () => {
      this.session = this.agent.createSession()
      logger.info('agent-create-session ', this.session.sessionId)
      return this.session.sessionId
    })

    ipcMainApi.handle('agent-resume-session', async (data) => {
      const sessionRows = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, data.sessionId))
      const sessionRow = sessionRows[0]

      const blocks = await db
        .select({
          id: schema.sessionWorkflowBlocks.id,
          userInput: schema.sessionWorkflowBlocks.input,
          parentBlockId: schema.sessionWorkflowBlocks.parentBlockId,
        })
        .from(schema.sessionWorkflowBlocks)
        .where(eq(schema.sessionWorkflowBlocks.sessionId, data.sessionId))
        .orderBy(asc(schema.sessionWorkflowBlocks.createdAt))

      const blockData: (BlockData & {
        parentBlockId: string | null
      })[] = []
      const askUserSubmitValues = new Map<string, string[]>()

      for (const block of blocks) {
        const blockMessageRows = await db
          .select()
          .from(schema.sessionWorkflowBlockMessages)
          .where(eq(schema.sessionWorkflowBlockMessages.blockId, block.id))
          .orderBy(asc(schema.sessionWorkflowBlockMessages.createdAt))
        const askUserQuestionRows = await db
          .select()
          .from(schema.askUserQuestions)
          .where(eq(schema.askUserQuestions.blockId, block.id))
          .orderBy(asc(schema.askUserQuestions.createdAt))
        const askUserQuestion = askUserQuestionRows[0]

        if (askUserQuestion?.answerJson) {
          askUserSubmitValues.set(block.id, JSON.parse(askUserQuestion.answerJson))
        }

        blockData.push({
          id: block.id,
          userInput: block.userInput,
          parentBlockId: block.parentBlockId,
          messages: blockMessageRows,
        })
      }

      const branchRows = await db
        .select({
          name: schema.sessionBranches.name,
          headWorkflowId: schema.sessionBranches.headBlockId,
        })
        .from(schema.sessionBranches)
        .where(eq(schema.sessionBranches.sessionId, data.sessionId))
        .orderBy(asc(schema.sessionBranches.createdAt))

      this.session = this.agent.resumeSession({
        sessionId: data.sessionId,
        activeBranch: sessionRow?.activeBranch || 'main',
        branches: branchRows,
        blockData,
      })

      const uiBlockData = blockData.map((block) => ({
        ...block,
        parentBlockId: block.parentBlockId,
        askUserSubmitValue: askUserSubmitValues.get(block.id),
      }))

      const plannerRows = await db
        .select()
        .from(schema.planners)
        .where(eq(schema.planners.sessionId, data.sessionId))

      const artifactRows = await db
        .select()
        .from(schema.artifacts)
        .where(eq(schema.artifacts.sessionId, data.sessionId))

      return {
        activeBranch: sessionRow?.activeBranch || 'main',
        branches: branchRows,
        planner: plannerRows.map((item) => ({
          id: item.id,
          plan: JSON.parse(item.planJson || '[]') as PlanStep[],
        })),
        blockData: uiBlockData,
        artifacts: artifactRows,
      }
    })

    ipcMainApi.handle('agent-session-send', async ({ input, branchName }) => {
      logger.info('agent-session-send ', input, branchName)
      this.session.run(input, branchName)
    })

    ipcMainApi.handle('agent-session-fork', async ({ targetBlockId, branchName }) => {
      logger.info('agent-session-fork ', branchName, targetBlockId)
      const targetNode = targetBlockId ? this.session.getWorkflowNode(targetBlockId) : null
      this.session.fork(branchName, targetNode)
    })

    ipcMainApi.handle('ask-user-question-submit', async (data) => {
      await db
        .update(schema.askUserQuestions)
        .set({
          answerJson: JSON.stringify(data.submitValue),
        })
        .where(eq(schema.askUserQuestions.blockId, data.workflowId))
    })
  }

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

    workflowEventNames.forEach((eventName) => {
      onWorkflowEvent(eventName, (data: any) => {
        ipcMainApi.send(eventName, data)
      })
    })
  }
}
