import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import {
  onAgentEvent,
  onArtifactEvent,
  onAskUserQuestionEvent,
  onPalnnerEvent,
  onWorkflowEvent,
} from '@/agent/core/apiEvent'
import type { AskUserQuestion } from '@/agent/core/tools/askUserQuestion'
import type { PlanStep } from '@/agent/core/tools/planner'
import { ThreadMessageRole } from '@/types'
import {
  artifacts,
  askUserQuestions,
  planners,
  sessionBranches,
  threads,
  threadWorkflowBlockMessages,
  threadWorkflowBlocks,
} from '@/db/schema'
import { db } from './databaseManager'
import type { AppManager } from './appManager'

export class ThreadsManager {
  constructor(private app: AppManager) {}

  init() {
    this.setupAgentEvents()
  }

  private async upsertSessionBranch(data: {
    sessionId: string
    branchName: string
    headBlockId: string | null
    createdFromBlockId?: string | null
  }) {
    const time = Date.now()
    const existingRows = await db
      .select()
      .from(sessionBranches)
      .where(
        and(eq(sessionBranches.threadId, data.sessionId), eq(sessionBranches.name, data.branchName))
      )

    const existingRow = existingRows[0]
    if (existingRow) {
      await db
        .update(sessionBranches)
        .set({
          headBlockId: data.headBlockId,
          createdFromBlockId:
            data.createdFromBlockId === undefined
              ? existingRow.createdFromBlockId
              : data.createdFromBlockId,
          updatedAt: time,
        })
        .where(eq(sessionBranches.id, existingRow.id))
      return
    }

    await db.insert(sessionBranches).values({
      id: uuid(),
      threadId: data.sessionId,
      name: data.branchName,
      headBlockId: data.headBlockId,
      createdFromBlockId: data.createdFromBlockId ?? data.headBlockId,
      createdAt: time,
      updatedAt: time,
    })
  }

  private async updateThreadSessionState(data: { sessionId: string; activeBranch: string }) {
    await db
      .update(threads)
      .set({
        activeBranch: data.activeBranch,
        updatedAt: Date.now(),
      })
      .where(eq(threads.id, data.sessionId))
  }

  setupAgentEvents() {
    onAgentEvent('agent-create-session', async (data) => {
      const time = Date.now()
      await db.insert(threads).values({
        id: data.sessionId,
        title: '',
        activeBranch: data.activeBranch,
        createdAt: time,
        updatedAt: time,
      })
      await this.upsertSessionBranch({
        sessionId: data.sessionId,
        branchName: data.activeBranch,
        headBlockId: null,
        createdFromBlockId: null,
      })
    })

    onAgentEvent('agent-session-forked', async (data) => {
      await this.updateThreadSessionState({
        sessionId: data.sessionId,
        activeBranch: data.branchName,
      })
      await this.upsertSessionBranch({
        sessionId: data.sessionId,
        branchName: data.branchName,
        headBlockId: data.sourceWorkflowId,
        createdFromBlockId: data.sourceWorkflowId,
      })
    })

    onWorkflowEvent('workflow-start', async ({ input, ctx }) => {
      const time = Date.now()
      const rows = await db.select().from(threads).where(eq(threads.id, ctx.sessionId))
      if (rows.length && !rows[0].title) {
        await db.update(threads).set({ title: input }).where(eq(threads.id, ctx.sessionId))
      }

      await this.updateThreadSessionState({
        sessionId: ctx.sessionId,
        activeBranch: ctx.branchName,
      })

      await db.insert(threadWorkflowBlocks).values({
        id: ctx.workflowId,
        threadId: ctx.sessionId,
        parentBlockId: ctx.parentWorkflowId,
        branchName: ctx.branchName,
        input,
        createdAt: time,
        updatedAt: time,
      })
      await this.upsertSessionBranch({
        sessionId: ctx.sessionId,
        branchName: ctx.branchName,
        headBlockId: ctx.workflowId,
      })

      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        role: ThreadMessageRole.User,
        blockId: ctx.workflowId,
        content: input,
        createdAt: time,
        updatedAt: time,
        payload: '',
      })
    })

    onWorkflowEvent('workflow-finished', async () => {})
    onWorkflowEvent('workflow-error', async ({ ctx, error }) => {
      console.log('onElectron main get workflow-error', ctx)
      console.log(error)
    })

    onWorkflowEvent('workflow-llm-start', async () => {})
    onWorkflowEvent('workflow-llm-error', async () => {})

    onWorkflowEvent('workflow-llm-reasoning-start', async () => {})
    onWorkflowEvent('workflow-llm-reasoning-delta', async () => {})
    onWorkflowEvent('workflow-llm-reasoning-end', async ({ ctx: { workflowId }, content }) => {
      const time = Date.now()
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        blockId: workflowId,
        role: ThreadMessageRole.AssistantReason,
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
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        blockId: workflowId,
        role: ThreadMessageRole.AssistantText,
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
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        blockId: workflowId,
        role: ThreadMessageRole.ToolCalls,
        content: '',
        payload: JSON.stringify(toolCalls),
        createdAt: time,
        updatedAt: time,
      })
    })

    onWorkflowEvent('workflow-tool-call-start', async () => {})
    onWorkflowEvent('workflow-tool-call-success', async ({ ctx, toolCallResult }) => {
      const time = Date.now()
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        role: ThreadMessageRole.Tool,
        blockId: ctx.workflowId,
        content: '',
        createdAt: time,
        updatedAt: time,
        payload: JSON.stringify(toolCallResult),
      })
    })
    onWorkflowEvent('workflow-tool-call-error', async ({ ctx, toolCallResult }) => {
      const time = Date.now()
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        role: ThreadMessageRole.Tool,
        blockId: ctx.workflowId,
        content: '',
        createdAt: time,
        updatedAt: time,
        payload: JSON.stringify(toolCallResult),
      })
    })
    onWorkflowEvent('workflow-tool-call-reject', async ({ ctx, toolCallResult }) => {
      const time = Date.now()
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        role: ThreadMessageRole.Tool,
        blockId: ctx.workflowId,
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
        threadId: sessionId,
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
        blockId: workflowId,
        draftJson: JSON.stringify(normalizedQuestion),
        createdAt: time,
        updatedAt: time,
      })
    })

    onArtifactEvent('artifacts-created-workspace', async ({ sessionId, workspaceName }) => {
      const time = Date.now()
      await db.insert(artifacts).values({
        id: uuid(),
        threadId: sessionId,
        artifactWorkspaceName: workspaceName,
        createdAt: time,
        updatedAt: time,
      })
    })
  }
}
