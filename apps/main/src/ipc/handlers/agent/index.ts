import { asc, eq } from 'drizzle-orm'
import { Agent, updateUserMemory } from '@vide/agent'
import type { Session } from '@vide/agent'
import type { PlanStep } from '@vide/agent/types'
import * as schema from '@/db/schema'
import { db } from '@/db/databaseManager'
import { logger } from '@/logger'
import type { AppManager } from '@/appManager'
import type { IpcMainService } from '@/ipc'
import type { WorkflowData } from '../../api/channels'
import { ipcMainApi } from '../../api/ipcMain'
import { SessionStorage } from '@/modules/sessionStorage'
import { settingsStore } from '@/modules/settingsStore'

export class AgentIpcMainService implements IpcMainService {
  agent: Agent
  sessions = new Map<string, Session>()

  constructor(private appManager: AppManager) {
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
      await SessionStorage.createSession({
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
      const session = await this.getSession(data.sessionId)
      const payload = await this.loadSessionPayload(data.sessionId)
      if (session.runningWorkflow) {
        const activeBranch = payload.branches.find((item) => item.name === session.activeBranch)
        if (activeBranch) {
          const target = payload.workflowData.find(
            (item) => item.id === activeBranch.headWorkflowId
          )
          activeBranch.headWorkflowId = target ? target.parentWorkflowId : null
        }
      }
      return payload
    })

    ipcMainApi.handle('agent-session-send', async ({ sessionId, input }) => {
      logger.info('agent-session-send ', sessionId, input)
      const session = await this.getSession(sessionId)
      const stream = session.send(input)
      for await (const { eventName, data } of stream) {
        const ctx = data.ctx
        ipcMainApi.send(eventName, data)
        switch (eventName) {
          case 'workflow-start': {
            const parentWorkflowId = session.currentBranch.head?.id ?? null
            await SessionStorage.setSessionTitle(ctx.sessionId, input)
            await SessionStorage.createWorkflow({
              workflowId: ctx.workflowId,
              sessionId: ctx.sessionId,
              parentWorkflowId,
              input,
            })
            await SessionStorage.upsertSessionBranch({
              sessionId: ctx.sessionId,
              branchName: session.activeBranch,
              headWorkflowId: ctx.workflowId,
            })
            await SessionStorage.insertUserMessage(ctx.workflowId, input)
            break
          }
          case 'workflow-finished': {
            await SessionStorage.finishWorkflow(ctx.workflowId)
            break
          }
          case 'workflow-aborted': {
            const chunkData = data.chunkData
            await SessionStorage.abortWorkflow(ctx.workflowId, chunkData)
            break
          }
          case 'workflow-error': {
            const error = data.error
            await SessionStorage.abortWorkflow(ctx.workflowId, error)
            break
          }

          case 'workflow-llm-start': {
            break
          }
          case 'workflow-llm-error': {
            break
          }

          case 'workflow-llm-reasoning-start': {
            break
          }
          case 'workflow-llm-reasoning-delta': {
            break
          }
          case 'workflow-llm-reasoning-end': {
            const { workflowId } = ctx
            const content = data.content
            await SessionStorage.insertAssistantReasoning(workflowId, content)
            break
          }

          case 'workflow-llm-text-start': {
            break
          }
          case 'workflow-llm-text-delta': {
            break
          }
          case 'workflow-llm-text-end': {
            const { workflowId } = ctx
            const content = data.content
            await SessionStorage.insertAssistantText(workflowId, content)
            break
          }

          case 'workflow-llm-tool-calls-start': {
            break
          }
          case 'workflow-llm-tool-call-name': {
            break
          }
          case 'workflow-llm-tool-call-arguments': {
            break
          }
          case 'workflow-llm-tool-calls-end': {
            const { workflowId } = ctx
            const toolCalls = data.toolCalls
            await SessionStorage.insertToolCalls(workflowId, toolCalls)
            break
          }

          case 'workflow-tool-call-start': {
            break
          }
          case 'workflow-tool-call-success': {
            const { workflowId } = ctx
            const toolCallResult = data.toolCallResult
            await SessionStorage.insertToolResult(workflowId, toolCallResult)
            break
          }
          case 'workflow-tool-call-error': {
            const { workflowId } = ctx
            const toolCallResult = data.toolCallResult
            await SessionStorage.insertToolResult(workflowId, toolCallResult)
            break
          }
          case 'workflow-tool-call-reject': {
            const { workflowId } = ctx
            const toolCallResult = data.toolCallResult
            await SessionStorage.insertToolResult(workflowId, toolCallResult)
            break
          }

          case 'planner-end-generate': {
            const { sessionId } = ctx
            const { plannerId, plans } = data
            await SessionStorage.createPlanner(sessionId, plannerId, plans)

            break
          }
          case 'planner-execute-item-start': {
            const { plannerId, plan } = data
            await SessionStorage.updatePlanner(plannerId, plan)
            break
          }
          case 'planner-execute-item-success': {
            const { plannerId, plan } = data
            await SessionStorage.updatePlanner(plannerId, plan)
            break
          }
          case 'planner-execute-item-error': {
            const { plannerId, plan } = data
            await SessionStorage.updatePlanner(plannerId, plan)
            break
          }

          case 'ask-user': {
            const { workflowId } = ctx
            const { question } = data
            await SessionStorage.insertAskUserQuestion(workflowId, question)
            break
          }

          case 'artifacts-created-workspace': {
            const { sessionId } = ctx
            const { workspaceName } = data
            await SessionStorage.createArtifactWorkspace(sessionId, workspaceName)
            break
          }
        }
      }
    })

    ipcMainApi.handle('agent-session-switch-auto-approve', async ({ sessionId, autoApprove }) => {
      logger.info('agent-session-switch-auto-approve ', sessionId, autoApprove)
      const session = await this.getSession(sessionId)
      session.autoApprove = autoApprove
      await SessionStorage.changeSessionAutoApprove(sessionId, autoApprove)
    })
    ipcMainApi.handle('agent-workflow-abort', async ({ sessionId, workflowId }) => {
      const session = await this.getSession(sessionId)
      const workflowNode = session.getWorkflowNode(workflowId)
      if (!workflowNode) return
      session.abortWorkflow()
    })

    ipcMainApi.handle('agent-update-user-memory', async ({ sessionId, workflowId, feedback }) => {
      const session = await this.getSession(sessionId)
      const workflowNode = session.getWorkflowNode(workflowId)
      if (!workflowNode) {
        throw new Error('Workflow not found: ' + workflowId)
      }
      if (feedback?.rating === 'like' || feedback?.rating === 'dislike') {
        await SessionStorage.updateWorkflowFeedback(workflowId, feedback.rating)
      }
      await updateUserMemory(workflowNode.messages, feedback)
    })

    ipcMainApi.handle('agent-human-approved', async ({ sessionId, workflowId, payload }) => {
      const session = await this.getSession(sessionId)
      session.humanApprove(workflowId, payload)

      await SessionStorage.handleToolCallApproval('human-approved', workflowId, payload)
    })

    ipcMainApi.handle('agent-human-rejected', async ({ sessionId, workflowId, payload }) => {
      const session = await this.getSession(sessionId)
      session.rejectHumanApprove(workflowId, payload)

      await SessionStorage.handleToolCallApproval('human-rejected', workflowId, payload)
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

      await SessionStorage.createSession({
        sessionId: forkedSession.sessionId,
        sessionType: forkedSession.sessionType,
        activeBranch: forkedSession.activeBranch,
        originSessionId: forkedSession.origin?.sessionId || null,
        originWorkflowId: forkedSession.origin?.workflowId || null,
        workspacePath: forkedSession.workspacePath,
        autoApprove: forkedSession.autoApprove,
        title: sourceSessionRow?.title || '',
      })
      await SessionStorage.cloneForkedSessionHistory({
        sourceSessionId,
        targetSessionId: forkedSession.sessionId,
        targetWorkflowId,
      })
      await SessionStorage.cloneSessionResources(sourceSessionId, forkedSession.sessionId)

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
        session.checkoutRegeneratedWorkflow(branchName, targetNode)
        await SessionStorage.checkoutSessionBranch({
          sessionId: sessionId,
          activeBranch: branchName,
        })
        const sourceWorkflowId = targetNode?.id || null
        await SessionStorage.upsertSessionBranch({
          sessionId: sessionId,
          branchName: branchName,
          headWorkflowId: sourceWorkflowId,
          sourceWorkflowId: sourceWorkflowId,
        })
      }
    )

    ipcMainApi.handle('ask-user-question-submit', async (data) => {
      await SessionStorage.updateAskUserQuestionAnswer(data.workflowId, data.submitValue)
    })

    ipcMainApi.handle('query-workflow-is-completed', async ({ sessionId, workflowId }) => {
      logger.info('query-workflow-is-completed ', sessionId, workflowId)
      const session = await this.getSession(sessionId)
      if (!session.runningWorkflow) return true
      if (session.runningWorkflow.runtime.workflowId !== workflowId) return true
      return session.runningWorkflow.state === 'COMPLETED'
    })

    ipcMainApi.handle('resume-running-workflow', async ({ sessionId, workflowId }) => {
      logger.info('resume-running-workflow ', sessionId, workflowId)
      const session = await this.getSession(sessionId)

      const events = session.runningWorkflow?.runtime.stream.events
      if (!events) return

      for (const { eventName, data } of events) {
        ipcMainApi.send(eventName, data)
      }
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

  private getWebSearchConfig() {
    return settingsStore.get('webSearchConfig')
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
        feedback: schema.sessionWorkflows.feedback,
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
        feedback: workflow.feedback,
        // @ts-expect-error role skip
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
}
