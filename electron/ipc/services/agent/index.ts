import { and, asc, eq } from 'drizzle-orm'
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
import { SessionMessageRole } from '@/types'
import type { ToolCall } from '@/agent/core/types'

export class AgentIpcMainService implements IpcMainService {
  agent: Agent
  sessions = new Map<string, Session>()

  constructor(private appManager: AppManager) {
    this.registerIpcMainSenders()
    this.agent = new Agent()
  }

  registerIpcMainHandle() {
    ipcMainApi.handle('agent-create-session', async (data) => {
      const workspacePath = data.workspacePath ?? null
      await this.appManager.workspaceManager.ensureVideHome(workspacePath)
      const session = this.agent.createSession({
        workspacePath,
        autoApprove: data.autoApprove,
      })
      this.sessions.set(session.sessionId, session)
      await this.appManager.sessionsManager.createSessionRecord({
        sessionId: session.sessionId,
        sessionType: session.sessionType,
        activeBranch: session.activeBranch,
        originSessionId: session.origin?.sessionId || null,
        originWorkflowId: session.origin?.workflowId || null,
        workspacePath: session.workspacePath,
        autoApprove: session.autoApprove,
      })
      logger.info('agent-create-session ', session.sessionId)
      return session.sessionId
    })

    ipcMainApi.handle('agent-resume-session', async (data) => {
      const payload = await this.loadSessionPayload(data.sessionId)
      const session = this.agent.resumeSession({
        sessionId: data.sessionId,
        sessionType: payload.sessionType,
        origin: payload.origin,
        workspacePath: payload.workspacePath,
        activeBranch: payload.activeBranch,
        branches: payload.branches,
        workflowData: payload.workflowData,
        autoApprove: payload.autoApprove,
      })
      this.sessions.set(data.sessionId, session)
      return payload
    })

    ipcMainApi.handle('agent-session-send', async ({ sessionId, input }) => {
      logger.info('agent-session-send ', sessionId, input)
      const session = await this.getSession(sessionId)
      session.run(input)
    })

    ipcMainApi.handle('agent-session-switch-auto-approve', async ({ sessionId, autoApprove }) => {
      logger.info('agent-session-switch-auto-approve ', sessionId, autoApprove)
      const session = await this.getSession(sessionId)
      session.autoApprove = autoApprove
      // DB update
      await db
        .update(schema.sessions)
        .set({
          autoApprove,
        })
        .where(eq(schema.sessions.id, sessionId))
    })
    ipcMainApi.handle('agent-workflow-abort', async ({ sessionId, workflowId }) => {
      const session = await this.getSession(sessionId)
      const workflowNode = session.getWorkflowNode(workflowId)
      if (!workflowNode) return
      session.abortWorkflow()
    })

    ipcMainApi.handle('agent-human-approved', async ({ sessionId, workflowId, payload }) => {
      const session = await this.getSession(sessionId)
      session.humanApprove(workflowId, payload)

      // db
      const targetToolCall = payload.toolCalls[payload.index]
      const targetMessages = await db
        .select()
        .from(schema.sessionWorkflowMessages)
        .where(
          and(
            eq(schema.sessionWorkflowMessages.workflowId, workflowId),
            eq(schema.sessionWorkflowMessages.role, SessionMessageRole.ToolCalls)
          )
        )
      const targetMessage = targetMessages.find((m) => {
        const toolCalls = JSON.parse(m.payload!) as ToolCall[]
        return toolCalls.some((t) => t.id === targetToolCall.id)
      })
      if (!targetMessage) return
      await db
        .update(schema.sessionWorkflowMessages)
        .set({
          payload: JSON.stringify(
            payload.toolCalls.map((t) => {
              if (t.id === targetToolCall.id) {
                return {
                  ...t,
                  status: 'human-approved',
                }
              }
              return t
            })
          ),
        })
        .where(and(eq(schema.sessionWorkflowMessages.id, targetMessage.id)))
    })

    ipcMainApi.handle('agent-human-rejected', async ({ sessionId, workflowId, payload }) => {
      const session = await this.getSession(sessionId)
      session.rejectHumanApprove(workflowId, payload)

      // db
      const targetToolCall = payload.toolCalls[payload.index]
      const targetMessages = await db
        .select()
        .from(schema.sessionWorkflowMessages)
        .where(
          and(
            eq(schema.sessionWorkflowMessages.workflowId, workflowId),
            eq(schema.sessionWorkflowMessages.role, SessionMessageRole.ToolCalls)
          )
        )
      const targetMessage = targetMessages.find((m) => {
        const toolCalls = JSON.parse(m.payload!) as ToolCall[]
        return toolCalls.some((t) => t.id === targetToolCall.id)
      })
      if (!targetMessage) return
      await db
        .update(schema.sessionWorkflowMessages)
        .set({
          payload: JSON.stringify(
            payload.toolCalls.map((t) => {
              if (t.id === targetToolCall.id) {
                return {
                  ...t,
                  status: 'human-rejected',
                }
              }
              return t
            })
          ),
        })
        .where(and(eq(schema.sessionWorkflowMessages.id, targetMessage.id)))
    })

    ipcMainApi.handle('agent-session-fork', async ({ sessionId, targetWorkflowId }) => {
      logger.info('agent-session-fork ', sessionId, targetWorkflowId)
      const sourceSession = await this.getSession(sessionId)
      const sourceSessionId = sourceSession.sessionId
      const sourceSessionRows = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, sourceSessionId))
      const sourceSessionRow = sourceSessionRows[0]
      const forkedSession = this.agent.forkSession(sourceSession, targetWorkflowId)

      await this.appManager.sessionsManager.createSessionRecord({
        sessionId: forkedSession.sessionId,
        sessionType: forkedSession.sessionType,
        activeBranch: forkedSession.activeBranch,
        originSessionId: forkedSession.origin?.sessionId || null,
        originWorkflowId: forkedSession.origin?.workflowId || null,
        workspacePath: forkedSession.workspacePath,
        autoApprove: forkedSession.autoApprove,
        title: sourceSessionRow?.title || '',
      })
      await this.appManager.sessionsManager.cloneForkedSessionHistory({
        sourceSessionId,
        targetSessionId: forkedSession.sessionId,
        targetWorkflowId,
      })
      await this.appManager.sessionsManager.cloneSessionResources(
        sourceSessionId,
        forkedSession.sessionId
      )

      const payload = await this.loadSessionPayload(forkedSession.sessionId)
      const resumedForkedSession = this.agent.resumeSession({
        sessionId: forkedSession.sessionId,
        sessionType: payload.sessionType,
        origin: payload.origin,
        workspacePath: payload.workspacePath,
        activeBranch: payload.activeBranch,
        branches: payload.branches,
        workflowData: payload.workflowData,
        autoApprove: payload.autoApprove,
      })
      this.sessions.set(forkedSession.sessionId, resumedForkedSession)

      return payload
    })

    ipcMainApi.handle(
      'agent-workflow-regenerate',
      async ({ sessionId, targetWorkflowId, branchName, input }) => {
        logger.info('agent-workflow-regenerate ', sessionId, branchName, targetWorkflowId, input)
        const session = await this.getSession(sessionId)
        const targetNode = session.getWorkflowNode(targetWorkflowId)
        if (!targetNode) return
        session.regenerateWorkflow(branchName, targetNode, input)
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

    ipcMainApi.handle('query-workflow-is-completed', async ({ sessionId, workflowId }) => {
      logger.info('query-workflow-is-completed ', sessionId, workflowId)
      const session = await this.getSession(sessionId)

      return session.runningWorkflow?.state === 'COMPLETED'
    })

    ipcMainApi.handle('resume-running-workflow', async ({ sessionId, workflowId }) => {
      logger.info('resume-running-workflow ', sessionId, workflowId)
      const session = await this.getSession(sessionId)

      return session.runningWorkflow?.runtime.workflowSession.messages ?? []
    })
  }

  private async getSession(sessionId: string) {
    const existing = this.sessions.get(sessionId)
    if (existing) return existing

    const payload = await this.loadSessionPayload(sessionId)
    const session = this.agent.resumeSession({
      sessionId,
      sessionType: payload.sessionType,
      origin: payload.origin,
      workspacePath: payload.workspacePath,
      activeBranch: payload.activeBranch,
      branches: payload.branches,
      workflowData: payload.workflowData,
      autoApprove: payload.autoApprove,
    })
    this.sessions.set(sessionId, session)
    return session
  }

  private async loadSessionPayload(sessionId: string) {
    const sessionRows = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
    const sessionRow = sessionRows[0]

    const workflows = await db
      .select({
        id: schema.sessionWorkflows.id,
        userInput: schema.sessionWorkflows.input,
        parentWorkflowId: schema.sessionWorkflows.parentWorkflowId,
        stopStatus: schema.sessionWorkflows.stopStatus,
      })
      .from(schema.sessionWorkflows)
      .where(eq(schema.sessionWorkflows.sessionId, sessionId))
      .orderBy(asc(schema.sessionWorkflows.createdAt))

    const workflowData: WorkflowData[] = []
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
        stopStatus: workflow.stopStatus ?? 'finished',
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
      .where(eq(schema.sessionBranches.sessionId, sessionId))
      .orderBy(asc(schema.sessionBranches.createdAt))

    const plannerRows = await db
      .select()
      .from(schema.planners)
      .where(eq(schema.planners.sessionId, sessionId))

    const artifactRows = await db
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.sessionId, sessionId))

    return {
      sessionId,
      title: sessionRow?.title || '',
      sessionType: sessionRow?.type || 'normal',
      autoApprove: sessionRow?.autoApprove || false,
      origin: sessionRow?.originSessionId
        ? {
            sessionId: sessionRow.originSessionId,
            workflowId: sessionRow.originWorkflowId,
          }
        : null,
      workspacePath: sessionRow?.workspacePath ?? null,
      activeBranch: sessionRow?.activeBranch || 'main',
      branches: branchRows,
      planner: plannerRows.map((item) => ({
        id: item.id,
        plan: JSON.parse(item.planJson || '[]') as PlanStep[],
      })),
      workflowData: workflowData.map((workflow) => ({
        ...workflow,
        askUserSubmitValue: askUserSubmitValues.get(workflow.id),
      })),
      artifacts: artifactRows,
    }
  }

  registerIpcMainSenders() {
    agentEventNames.forEach((eventName) => {
      onAgentEvent(eventName, (data: any) => {
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
