import { and, asc, eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import type { SessionType } from '@vide/agent'
import {
  artifacts,
  askUserQuestions,
  planners,
  sessionBranches,
  sessions,
  sessionWorkflowMessages,
  sessionWorkflows,
} from '@/db/schema'
import { db } from '@/databaseManager'
import { MessageRole, type ToolCall } from '@vide/ai'
import type { AskUserQuestion, PlanStep } from '@vide/agent/types'

export class SessionStorage {
  static async upsertSessionBranch(data: {
    sessionId: string
    branchName: string
    headWorkflowId: string | null
    sourceWorkflowId?: string | null
  }) {
    const time = Date.now()

    const existingRows = await db
      .select()
      .from(sessionBranches)
      .where(
        and(
          eq(sessionBranches.sessionId, data.sessionId),
          eq(sessionBranches.name, data.branchName)
        )
      )

    const existingRow = existingRows[0]

    if (existingRow) {
      await db
        .update(sessionBranches)
        .set({
          headWorkflowId: data.headWorkflowId,
          sourceWorkflowId:
            data.sourceWorkflowId === undefined
              ? existingRow.sourceWorkflowId
              : data.sourceWorkflowId,
          updatedAt: time,
        })
        .where(eq(sessionBranches.id, existingRow.id))

      return
    }

    await db.insert(sessionBranches).values({
      id: uuid(),
      sessionId: data.sessionId,
      name: data.branchName,
      headWorkflowId: data.headWorkflowId,
      sourceWorkflowId: data.sourceWorkflowId,
      createdAt: time,
      updatedAt: time,
    })
  }

  static async updateSessionState(data: { sessionId: string; activeBranch: string }) {
    await db
      .update(sessions)
      .set({
        activeBranch: data.activeBranch,
        updatedAt: Date.now(),
      })
      .where(eq(sessions.id, data.sessionId))
  }

  static async createSessionRecord(data: {
    sessionId: string
    sessionType: SessionType
    activeBranch: string
    originSessionId: string | null
    originWorkflowId: string | null
    workspacePath: string | null
    autoApprove: boolean
    title?: string
  }) {
    const time = Date.now()

    await db.insert(sessions).values({
      id: data.sessionId,
      title: data.title || '',
      type: data.sessionType,
      originSessionId: data.originSessionId,
      originWorkflowId: data.originWorkflowId,
      workspacePath: data.workspacePath ?? null,
      activeBranch: data.activeBranch,
      autoApprove: data.autoApprove,
      createdAt: time,
      updatedAt: time,
    })

    await this.upsertSessionBranch({
      sessionId: data.sessionId,
      branchName: data.activeBranch,
      headWorkflowId: null,
      sourceWorkflowId: null,
    })
  }

  static async cloneSessionResources(sourceSessionId: string, targetSessionId: string) {
    const time = Date.now()

    const sourcePlanners = await db
      .select()
      .from(planners)
      .where(eq(planners.sessionId, sourceSessionId))

    const sourceArtifacts = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.sessionId, sourceSessionId))

    for (const planner of sourcePlanners) {
      await db.insert(planners).values({
        id: uuid(),
        sessionId: targetSessionId,
        planJson: planner.planJson,
        createdAt: time,
        updatedAt: time,
      })
    }

    for (const artifact of sourceArtifacts) {
      await db.insert(artifacts).values({
        id: uuid(),
        sessionId: targetSessionId,
        artifactWorkspaceName: artifact.artifactWorkspaceName,
        createdAt: time,
        updatedAt: time,
      })
    }
  }

  static async cloneForkedSessionHistory(data: {
    sourceSessionId: string
    targetSessionId: string
    targetWorkflowId: string
  }) {
    const workflows = await db
      .select()
      .from(sessionWorkflows)
      .where(eq(sessionWorkflows.sessionId, data.sourceSessionId))
      .orderBy(asc(sessionWorkflows.createdAt))

    const workflowMap = new Map(workflows.map((workflow) => [workflow.id, workflow]))

    const lineage: (typeof workflows)[number][] = []
    let currentWorkflow = workflowMap.get(data.targetWorkflowId) || null

    while (currentWorkflow) {
      lineage.unshift(currentWorkflow)
      currentWorkflow = currentWorkflow.parentWorkflowId
        ? (workflowMap.get(currentWorkflow.parentWorkflowId) ?? null)
        : null
    }

    const workflowIdMap = new Map<string, string>()
    const clonedHeadWorkflowId = lineage.at(-1)?.id ? uuid() : null

    for (const [index, workflow] of lineage.entries()) {
      const clonedWorkflowId =
        index === lineage.length - 1 && clonedHeadWorkflowId ? clonedHeadWorkflowId : uuid()

      workflowIdMap.set(workflow.id, clonedWorkflowId)
    }

    const timeBase = Date.now()

    for (const [index, workflow] of lineage.entries()) {
      const clonedWorkflowId = workflowIdMap.get(workflow.id)!
      const clonedParentWorkflowId = workflow.parentWorkflowId
        ? (workflowIdMap.get(workflow.parentWorkflowId) ?? null)
        : null

      await db.insert(sessionWorkflows).values({
        id: clonedWorkflowId,
        sessionId: data.targetSessionId,
        parentWorkflowId: clonedParentWorkflowId,
        stopStatus: workflow.stopStatus,
        input: workflow.input,
        createdAt: timeBase + index,
        updatedAt: timeBase + index,
      })

      const workflowMessages = await db
        .select()
        .from(sessionWorkflowMessages)
        .where(eq(sessionWorkflowMessages.workflowId, workflow.id))
        .orderBy(asc(sessionWorkflowMessages.createdAt))

      for (const [messageIndex, message] of workflowMessages.entries()) {
        await db.insert(sessionWorkflowMessages).values({
          id: uuid(),
          workflowId: clonedWorkflowId,
          role: message.role,
          content: message.content,
          payload: message.payload,
          createdAt: timeBase + index * 1000 + messageIndex,
          updatedAt: timeBase + index * 1000 + messageIndex,
        })
      }

      const askUserRows = await db
        .select()
        .from(askUserQuestions)
        .where(eq(askUserQuestions.workflowId, workflow.id))
        .orderBy(asc(askUserQuestions.createdAt))

      for (const askUserRow of askUserRows) {
        await db.insert(askUserQuestions).values({
          id: uuid(),
          workflowId: clonedWorkflowId,
          draftJson: askUserRow.draftJson,
          answerJson: askUserRow.answerJson,
          createdAt: timeBase + index,
          updatedAt: timeBase + index,
        })
      }
    }

    await this.upsertSessionBranch({
      sessionId: data.targetSessionId,
      branchName: 'main',
      headWorkflowId: workflowIdMap.get(data.targetWorkflowId) ?? null,
      sourceWorkflowId: null,
    })
  }

  static async setSessionTitle(sessionId: string, title: string) {
    const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId))

    if (!rows.length || rows[0].title) {
      return
    }

    await db
      .update(sessions)
      .set({
        title,
      })
      .where(eq(sessions.id, sessionId))
  }

  static async createWorkflow(data: {
    workflowId: string
    sessionId: string
    parentWorkflowId: string | null
    input: string
  }) {
    const time = Date.now()

    await db.insert(sessionWorkflows).values({
      id: data.workflowId,
      sessionId: data.sessionId,
      parentWorkflowId: data.parentWorkflowId,
      input: data.input,
      createdAt: time,
      updatedAt: time,
    })
  }

  static async finishWorkflow(workflowId: string) {
    await db
      .update(sessionWorkflows)
      .set({
        stopStatus: 'finished',
        updatedAt: Date.now(),
      })
      .where(eq(sessionWorkflows.id, workflowId))
  }

  static async abortWorkflow(
    workflowId: string,
    chunkData: {
      text?: string
      reasoning?: string
    }
  ) {
    const time = Date.now()

    if (chunkData.text) {
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        workflowId,
        role: MessageRole.AssistantText,
        content: chunkData.text,
        payload: '',
        createdAt: time,
        updatedAt: time,
      })
    }

    if (chunkData.reasoning) {
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        workflowId,
        role: MessageRole.AssistantReason,
        content: chunkData.reasoning,
        payload: '',
        createdAt: time,
        updatedAt: time,
      })
    }

    await db
      .update(sessionWorkflows)
      .set({
        stopStatus: 'aborted',
        updatedAt: time,
      })
      .where(eq(sessionWorkflows.id, workflowId))

    await db.insert(sessionWorkflowMessages).values({
      id: uuid(),
      role: MessageRole.Abort,
      workflowId,
      content: 'The user aborted this workflow before it completed.',
      payload: '',
      createdAt: time,
      updatedAt: time,
    })
  }

  static async errorWorkflow(workflowId: string) {
    await db
      .update(sessionWorkflows)
      .set({
        stopStatus: 'error',
        updatedAt: Date.now(),
      })
      .where(eq(sessionWorkflows.id, workflowId))
  }

  static async insertUserMessage(workflowId: string, content: string) {
    const time = Date.now()

    await db.insert(sessionWorkflowMessages).values({
      id: uuid(),
      workflowId,
      role: MessageRole.User,
      content,
      payload: '',
      createdAt: time,
      updatedAt: time,
    })
  }

  static async insertAssistantReasoning(workflowId: string, content: string) {
    const time = Date.now()

    await db.insert(sessionWorkflowMessages).values({
      id: uuid(),
      workflowId,
      role: MessageRole.AssistantReason,
      content,
      payload: '',
      createdAt: time,
      updatedAt: time,
    })
  }

  static async insertAssistantText(workflowId: string, content: string) {
    const time = Date.now()

    await db.insert(sessionWorkflowMessages).values({
      id: uuid(),
      workflowId,
      role: MessageRole.AssistantText,
      content,
      payload: '',
      createdAt: time,
      updatedAt: time,
    })
  }

  static async insertToolCalls(workflowId: string, toolCalls: ToolCall[]) {
    const time = Date.now()

    await db.insert(sessionWorkflowMessages).values({
      id: uuid(),
      workflowId,
      role: MessageRole.ToolCalls,
      content: '',
      payload: JSON.stringify(toolCalls),
      createdAt: time,
      updatedAt: time,
    })
  }

  static async insertToolResult(workflowId: string, toolCallResult: unknown) {
    const time = Date.now()

    await db.insert(sessionWorkflowMessages).values({
      id: uuid(),
      workflowId,
      role: MessageRole.Tool,
      content: '',
      payload: JSON.stringify(toolCallResult),
      createdAt: time,
      updatedAt: time,
    })
  }

  static async insertAbortMessage(workflowId: string) {
    const time = Date.now()

    await db.insert(sessionWorkflowMessages).values({
      id: uuid(),
      workflowId,
      role: MessageRole.Abort,
      content: 'The user aborted this workflow before it completed.',
      payload: '',
      createdAt: time,
      updatedAt: time,
    })
  }

  static async createPlanner(sessionId: string, plannerId: string, plans: PlanStep[]) {
    const time = Date.now()

    await db.insert(planners).values({
      id: plannerId,
      sessionId,
      planJson: JSON.stringify(plans),
      createdAt: time,
      updatedAt: time,
    })
  }

  static async updatePlanner(plannerId: string, plan: PlanStep) {
    const rows = await db.select().from(planners).where(eq(planners.id, plannerId))

    if (!rows.length) return
    const target = rows[0]
    const planJson = JSON.parse(target.planJson ?? '[]') as PlanStep[]
    const updated = planJson.map((item) => {
      if (item.id === plan.id) {
        item.status = plan.status
      }
      return item
    })
    await db
      .update(planners)
      .set({
        planJson: JSON.stringify(updated),
        updatedAt: Date.now(),
      })
      .where(eq(planners.id, plannerId))
  }

  static async insertAskUserQuestion(workflowId: string, question: AskUserQuestion) {
    const time = Date.now()
    const normalizedQuestion: AskUserQuestion = {
      type: question.type === 'multiple' ? 'multiple' : 'single',
      title: question.title,
      description: question.description,
      options: question.options,
    }

    await db.insert(askUserQuestions).values({
      id: uuid(),
      workflowId,
      draftJson: JSON.stringify(normalizedQuestion),
      createdAt: time,
      updatedAt: time,
    })
  }

  static async updateAskUserQuestionAnswer(workflowId: string, answer: unknown) {}

  static async createArtifactWorkspace(sessionId: string, workspaceName: string) {
    const time = Date.now()
    await db.insert(artifacts).values({
      id: uuid(),
      sessionId,
      artifactWorkspaceName: workspaceName,
      createdAt: time,
      updatedAt: time,
    })
  }
}
