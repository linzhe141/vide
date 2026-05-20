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
import type { WorkflowData } from '../../api/channels'
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

      const workflows = await db
        .select({
          id: schema.sessionWorkflows.id,
          userInput: schema.sessionWorkflows.input,
          parentWorkflowId: schema.sessionWorkflows.parentWorkflowId,
        })
        .from(schema.sessionWorkflows)
        .where(eq(schema.sessionWorkflows.sessionId, data.sessionId))
        .orderBy(asc(schema.sessionWorkflows.createdAt))

      const workflowData: (WorkflowData & {
        parentWorkflowId: string | null
      })[] = []
      const askUserSubmitValues = new Map<string, string[]>()

      for (const workflow of workflows) {
        const workflowMessageRows = await db
          .select()
          .from(schema.sessionWorkflowMessages)
          .where(eq(schema.sessionWorkflowMessages.workflowId, workflow.id))
          .orderBy(asc(schema.sessionWorkflowMessages.createdAt))
        const askUserQuestionRows = await db
          .select()
          .from(schema.askUserQuestions)
          .where(eq(schema.askUserQuestions.workflowId, workflow.id))
          .orderBy(asc(schema.askUserQuestions.createdAt))
        const askUserQuestion = askUserQuestionRows[0]

        if (askUserQuestion?.answerJson) {
          askUserSubmitValues.set(workflow.id, JSON.parse(askUserQuestion.answerJson))
        }

        workflowData.push({
          id: workflow.id,
          userInput: workflow.userInput,
          parentWorkflowId: workflow.parentWorkflowId,
          messages: workflowMessageRows,
        })
      }

      const branchRows = await db
        .select({
          name: schema.sessionBranches.name,
          headWorkflowId: schema.sessionBranches.headWorkflowId,
          sourceWorkflowId: schema.sessionBranches.sourceWorkflowId,
        })
        .from(schema.sessionBranches)
        .where(eq(schema.sessionBranches.sessionId, data.sessionId))
        .orderBy(asc(schema.sessionBranches.createdAt))

      this.session = this.agent.resumeSession({
        sessionId: data.sessionId,
        activeBranch: sessionRow?.activeBranch || 'main',
        branches: branchRows,
        workflowData,
      })

      const uiWorkflowData = workflowData.map((workflow) => ({
        ...workflow,
        parentWorkflowId: workflow.parentWorkflowId,
        askUserSubmitValue: askUserSubmitValues.get(workflow.id),
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
        workflowData: uiWorkflowData,
        artifacts: artifactRows,
      }
    })

    ipcMainApi.handle('agent-session-send', async ({ input }) => {
      logger.info('agent-session-send ', input)
      this.session.run(input)
    })

    ipcMainApi.handle('agent-session-fork', async ({ targetWorkflowId, branchName }) => {
      logger.info('agent-session-fork ', branchName, targetWorkflowId)
      const targetNode = targetWorkflowId ? this.session.getWorkflowNode(targetWorkflowId) : null
      this.session.fork(branchName, targetNode)
    })

    ipcMainApi.handle(
      'agent-workflow-regenerate',
      async ({ targetWorkflowId, branchName, input }) => {
        logger.info('agent-workflow-regenerate ', branchName, targetWorkflowId, input)
        const targetNode = this.session.getWorkflowNode(targetWorkflowId)
        if (!targetNode) return
        this.session.regenerateWorkflow(branchName, targetNode, input)
      }
    )

    ipcMainApi.handle('ask-user-question-submit', async (data) => {
      await db
        .update(schema.askUserQuestions)
        .set({
          answerJson: JSON.stringify(data.submitValue),
        })
        .where(eq(schema.askUserQuestions.workflowId, data.workflowId))
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
