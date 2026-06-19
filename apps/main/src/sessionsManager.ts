import { and, asc, eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import {
  onAgentEvent,
  onArtifactEvent,
  onAskUserQuestionEvent,
  onPalnnerEvent,
  onWorkflowEvent,
} from '@/agent/apiEvent'
import type { SessionType } from '@/agent/session'
import type { AskUserQuestion } from '@/agent/tools/askUserQuestion'
import type { PlanStep } from '@/agent/tools/planner'
import { SessionMessageRole } from '@/types'
import {
  artifacts,
  askUserQuestions,
  planners,
  sessionBranches,
  sessions,
  sessionWorkflowMessages,
  sessionWorkflows,
} from '@/main/db/schema'
import { db } from './databaseManager'
import type { AppManager } from './appManager'

export class SessionsManager {
  constructor(private app: AppManager) {}

  init() {
    this.setupAgentEvents()
  }

  private async upsertSessionBranch(data: {
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

  private async updateSessionState(data: { sessionId: string; activeBranch: string }) {
    await db
      .update(sessions)
      .set({
        activeBranch: data.activeBranch,
        updatedAt: Date.now(),
      })
      .where(eq(sessions.id, data.sessionId))
  }

  async createSessionRecord(data: {
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

  async cloneSessionResources(sourceSessionId: string, targetSessionId: string) {
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

  async cloneForkedSessionHistory(data: {
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

  setupAgentEvents() {
    onAgentEvent('agent-workflow-regenerated', async (data) => {
      await this.updateSessionState({
        sessionId: data.sessionId,
        activeBranch: data.branchName,
      })
      await this.upsertSessionBranch({
        sessionId: data.sessionId,
        branchName: data.branchName,
        headWorkflowId: data.sourceWorkflowId,
        sourceWorkflowId: data.sourceWorkflowId,
      })
    })

    onWorkflowEvent('workflow-start', async ({ input, ctx }) => {
      const time = Date.now()
      const rows = await db.select().from(sessions).where(eq(sessions.id, ctx.sessionId))
      if (rows.length && !rows[0].title) {
        await db.update(sessions).set({ title: input }).where(eq(sessions.id, ctx.sessionId))
      }

      // await this.updateSessionState({
      //   sessionId: ctx.sessionId,
      //   activeBranch: ctx.branchName,
      // })

      await db.insert(sessionWorkflows).values({
        id: ctx.workflowId,
        sessionId: ctx.sessionId,
        parentWorkflowId: ctx.parentWorkflowId,
        input,
        createdAt: time,
        updatedAt: time,
      })
      await this.upsertSessionBranch({
        sessionId: ctx.sessionId,
        branchName: ctx.branchName,
        headWorkflowId: ctx.workflowId,
      })

      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        role: SessionMessageRole.User,
        workflowId: ctx.workflowId,
        content: input,
        createdAt: time,
        updatedAt: time,
        payload: '',
      })
    })

    onWorkflowEvent('workflow-finished', async ({ ctx }) => {
      await db
        .update(sessionWorkflows)
        .set({
          stopStatus: 'finished',
          updatedAt: Date.now(),
        })
        .where(eq(sessionWorkflows.id, ctx.workflowId))
    })
    // TODO 鏄惁闇€瑕佹寔涔呭寲 waiting-human-approve 鐘舵€?
    // workflow-wait-human-approve 鏇存柊 stopStatus 涓?waiting-human-approve 鐘舵€?
    // onWorkflowEvent('workflow-wait-human-approve', async ({ ctx }) => {
    //   await db
    //     .update(sessionWorkflows)
    //     .set({
    //       stopStatus: 'waiting-human-approve',
    //       updatedAt: Date.now(),
    //     })
    //     .where(eq(sessionWorkflows.id, ctx.workflowId))
    // })
    onWorkflowEvent('workflow-aborted', async ({ ctx, chunkData }) => {
      const time = Date.now()
      // abort 鏃讹紝鎶婃湭鎸佷箙鍖栫殑 reasoning 鍜?text chunk 瀛樺偍涓烘秷鎭紝鐒跺悗鏇存柊 workflow 鐘舵€佷负 aborted
      if (chunkData.text) {
        await db.insert(sessionWorkflowMessages).values({
          id: uuid(),
          workflowId: ctx.workflowId,
          role: SessionMessageRole.AssistantText,
          content: chunkData.text,
          payload: '',
          createdAt: time,
          updatedAt: time,
        })
      }
      if (chunkData.reasoning) {
        await db.insert(sessionWorkflowMessages).values({
          id: uuid(),
          workflowId: ctx.workflowId,
          role: SessionMessageRole.AssistantReason,
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
        .where(eq(sessionWorkflows.id, ctx.workflowId))
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        role: SessionMessageRole.Abort,
        workflowId: ctx.workflowId,
        content: 'The user aborted this workflow before it completed.',
        createdAt: time,
        updatedAt: time,
        payload: '',
      })
    })
    onWorkflowEvent('workflow-error', async ({ ctx, error }) => {
      await db
        .update(sessionWorkflows)
        .set({
          stopStatus: 'error',
          updatedAt: Date.now(),
        })
        .where(eq(sessionWorkflows.id, ctx.workflowId))
      console.log('onElectron main get workflow-error', ctx)
      console.log(error)
    })

    onWorkflowEvent('workflow-llm-start', async () => {})
    onWorkflowEvent('workflow-llm-error', async () => {})

    onWorkflowEvent('workflow-llm-reasoning-start', async () => {})
    onWorkflowEvent('workflow-llm-reasoning-delta', async () => {})
    onWorkflowEvent('workflow-llm-reasoning-end', async ({ ctx: { workflowId }, content }) => {
      const time = Date.now()
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        workflowId,
        role: SessionMessageRole.AssistantReason,
        content,
        payload: '',
        createdAt: time,
        updatedAt: time,
      })
    })

    onWorkflowEvent('workflow-llm-text-start', async () => {})
    onWorkflowEvent('workflow-llm-text-delta', async () => {})
    onWorkflowEvent('workflow-llm-text-end', async ({ ctx: { workflowId }, content }) => {
      const time = Date.now()
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        workflowId,
        role: SessionMessageRole.AssistantText,
        content,
        payload: '',
        createdAt: time,
        updatedAt: time,
      })
    })

    onWorkflowEvent('workflow-llm-tool-calls-start', async () => {})
    onWorkflowEvent('workflow-llm-tool-call-name', async () => {})
    onWorkflowEvent('workflow-llm-tool-call-arguments', async () => {})
    onWorkflowEvent('workflow-llm-tool-calls-end', async ({ ctx: { workflowId }, toolCalls }) => {
      const time = Date.now()
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        workflowId,
        role: SessionMessageRole.ToolCalls,
        content: '',
        payload: JSON.stringify(toolCalls),
        createdAt: time,
        updatedAt: time,
      })
    })

    onWorkflowEvent('workflow-tool-call-start', async () => {})
    onWorkflowEvent('workflow-tool-call-success', async ({ ctx, toolCallResult }) => {
      const time = Date.now()
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        role: SessionMessageRole.Tool,
        workflowId: ctx.workflowId,
        content: '',
        createdAt: time,
        updatedAt: time,
        payload: JSON.stringify(toolCallResult),
      })
    })
    onWorkflowEvent('workflow-tool-call-error', async ({ ctx, toolCallResult }) => {
      const time = Date.now()
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        role: SessionMessageRole.Tool,
        workflowId: ctx.workflowId,
        content: '',
        createdAt: time,
        updatedAt: time,
        payload: JSON.stringify(toolCallResult),
      })
    })
    onWorkflowEvent('workflow-tool-call-reject', async ({ ctx, toolCallResult }) => {
      const time = Date.now()
      await db.insert(sessionWorkflowMessages).values({
        id: uuid(),
        role: SessionMessageRole.Tool,
        workflowId: ctx.workflowId,
        content: '',
        payload: JSON.stringify(toolCallResult),
        createdAt: time,
        updatedAt: time,
      })
    })

    onPalnnerEvent('planner-end-generate', async ({ sessionId, plannerId, plans }) => {
      const time = Date.now()
      await db.insert(planners).values({
        id: plannerId,
        sessionId: sessionId,
        planJson: JSON.stringify(plans),
        createdAt: time,
        updatedAt: time,
      })
    })
    onPalnnerEvent('planner-execute-item-start', async ({ plan, plannerId }) => {
      const target = await db.select().from(planners).where(eq(planners.id, plannerId))
      if (!target.length) return
      const targetRow = target[0]
      const planJson = JSON.parse(targetRow.planJson ?? '[]') as PlanStep[]
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
    })
    onPalnnerEvent('planner-execute-item-success', async ({ plan, plannerId }) => {
      const target = await db.select().from(planners).where(eq(planners.id, plannerId))
      if (!target.length) return
      const targetRow = target[0]
      const planJson = JSON.parse(targetRow.planJson ?? '[]') as PlanStep[]
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
    })
    onPalnnerEvent('planner-execute-item-error', async ({ plan, plannerId }) => {
      const target = await db.select().from(planners).where(eq(planners.id, plannerId))
      if (!target.length) return
      const targetRow = target[0]
      const planJson = JSON.parse(targetRow.planJson ?? '[]') as PlanStep[]
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
    })

    onAskUserQuestionEvent('ask-user', async ({ workflowId, question }) => {
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
    })

    onArtifactEvent('artifacts-created-workspace', async ({ sessionId, workspaceName }) => {
      const time = Date.now()
      await db.insert(artifacts).values({
        id: uuid(),
        sessionId: sessionId,
        artifactWorkspaceName: workspaceName,
        createdAt: time,
        updatedAt: time,
      })
    })
  }
}

