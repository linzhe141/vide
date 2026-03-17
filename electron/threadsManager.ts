import type { AppManager } from './appManager'
import {
  onAgentEvent,
  onAskUserQuestionEvent,
  onPalnnerEvent,
  onWorkflowEvent,
} from '@/agent/core/apiEvent'
import { v4 as uuid } from 'uuid'
import { db } from './databaseManager'
import {
  askUserQuestions,
  planners,
  threads,
  threadWorkflowBlockMessages,
  threadWorkflowBlocks,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ThreadMessageRole } from '@/types'
import type { PlanStep } from '@/agent/core/tools/planner'
import type { AskUserQuestionDraft } from '@/agent/core/tools/askUserQuestion'

export class ThreadsManager {
  // for building in memory before end node
  currentPlannerId: string | null = null
  currentPlannerDraft: PlanStep[] = []
  currentAaskUserQuestionId: string | null = null
  currentAskUserQuestionDraft: AskUserQuestionDraft | null = null
  constructor(private app: AppManager) {}

  init() {
    this.setupAgentEvents()
  }

  // 只有end后才存入数据库
  setupAgentEvents() {
    onAgentEvent('agent-create-session', async (data) => {
      const time = Date.now()
      await db.insert(threads).values({
        id: data.sessionId,
        title: '',
        createdAt: time,
        updatedAt: time,
      })
    })

    onWorkflowEvent('workflow-start', async ({ input, ctx: { sessionId, workflowId } }) => {
      const time = Date.now()

      const rows = await db.select().from(threads).where(eq(threads.id, sessionId))
      if (rows.length && !rows[0].title) {
        await db.update(threads).set({ title: input }).where(eq(threads.id, sessionId))
      }

      // insert workflow block
      await db.insert(threadWorkflowBlocks).values({
        id: workflowId,
        threadId: sessionId,
        input,
        createdAt: time,
        updatedAt: time,
      })
      // insert workflow block message
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        role: ThreadMessageRole.User,
        blockId: workflowId,
        content: input,
        createdAt: time,
        updatedAt: time,
        payload: '',
      })

      // TODO update title
    })
    onWorkflowEvent('workflow-finished', async () => {})
    onWorkflowEvent('workflow-error', async ({ ctx, error }) => {
      console.log(ctx, error)
    })

    onWorkflowEvent('workflow-llm-start', async () => {})
    onWorkflowEvent('workflow-llm-error', async () => {})

    onWorkflowEvent('workflow-llm-reasoning-start', async () => {})
    onWorkflowEvent('workflow-llm-reasoning-delta', async () => {})
    onWorkflowEvent('workflow-llm-reasoning-end', async ({ ctx: { workflowId }, content }) => {
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        blockId: workflowId,
        role: ThreadMessageRole.AssistantReason,
        content: content,
        payload: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    onWorkflowEvent('workflow-llm-text-start', async () => {})
    onWorkflowEvent('workflow-llm-text-delta', async () => {})
    onWorkflowEvent('workflow-llm-text-end', async ({ ctx: { workflowId }, content }) => {
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        blockId: workflowId,
        role: ThreadMessageRole.AssistantText,
        content: content,
        payload: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    onWorkflowEvent('workflow-llm-tool-calls-start', async () => {})
    onWorkflowEvent('workflow-llm-tool-call-name', async () => {})
    onWorkflowEvent('workflow-llm-tool-call-arguments', async () => {})
    onWorkflowEvent('workflow-llm-tool-calls-end', async ({ ctx: { workflowId }, toolCalls }) => {
      await db.insert(threadWorkflowBlockMessages).values({
        id: uuid(),
        blockId: workflowId,
        role: ThreadMessageRole.ToolCalls,
        content: '',
        payload: JSON.stringify(toolCalls),
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
        createdAt: time,
        updatedAt: time,
        payload: JSON.stringify(toolCallResult),
      })
    })

    // runtime - build in memory, insert only at end
    onPalnnerEvent('planner-start-generate', async ({ workflowId }) => {
      this.currentPlannerId = uuid()
      this.currentPlannerDraft = []
    })

    onPalnnerEvent('planner-step-generate', async ({ plan }) => {
      // accumulate in memory only
      this.currentPlannerDraft.push(plan)
    })

    onPalnnerEvent('planner-end-generate', async ({ workflowId }) => {
      const time = Date.now()
      // insert complete plan at once
      await db.insert(planners).values({
        id: this.currentPlannerId!,
        blockId: workflowId,
        completedGenerate: 'true',
        planJson: JSON.stringify(this.currentPlannerDraft),
        createdAt: time,
        updatedAt: time,
      })
      this.currentPlannerDraft = []
    })

    onPalnnerEvent('planner-execute-item-start', async ({ plan }) => {
      const target = await db.select().from(planners).where(eq(planners.id, this.currentPlannerId!))
      if (!target.length) {
        return
      }
      const targetRow = target[0]
      const planJson = JSON.parse(targetRow.planJson ?? '[]') as PlanStep[]
      const uptated = planJson.map((i) => {
        if (i.id === plan.id) {
          i.status = plan.status
        }
        return i
      })

      const time = Date.now()
      await db
        .update(planners)
        .set({
          planJson: JSON.stringify(uptated),
          updatedAt: time,
        })
        .where(eq(planners.id, this.currentPlannerId!))
    })

    onPalnnerEvent('planner-execute-item-success', async ({ plan }) => {
      const target = await db.select().from(planners).where(eq(planners.id, this.currentPlannerId!))
      if (!target.length) {
        return
      }
      const targetRow = target[0]
      const planJson = JSON.parse(targetRow.planJson ?? '[]') as PlanStep[]
      const uptated = planJson.map((i) => {
        if (i.id === plan.id) {
          i.status = plan.status
        }
        return i
      })

      const time = Date.now()
      await db
        .update(planners)
        .set({
          planJson: JSON.stringify(uptated),
          updatedAt: time,
        })
        .where(eq(planners.id, this.currentPlannerId!))

      if (uptated.every((i) => i.status === 'completed')) {
        this.currentPlannerId = null
      }
    })

    onPalnnerEvent('planner-execute-item-error', async ({ plan }) => {
      const target = await db.select().from(planners).where(eq(planners.id, this.currentPlannerId!))
      if (!target.length) {
        return
      }
      const targetRow = target[0]
      const planJson = JSON.parse(targetRow.planJson ?? '[]') as PlanStep[]
      const uptated = planJson.map((i) => {
        if (i.id === plan.id) {
          i.status = plan.status
        }
        return i
      })

      const time = Date.now()
      await db
        .update(planners)
        .set({
          planJson: JSON.stringify(uptated),
          updatedAt: time,
        })
        .where(eq(planners.id, this.currentPlannerId!))
    })

    // ask user question - build in memory, insert only at end
    onAskUserQuestionEvent('ask-user-start-generate', async ({ workflowId, type }) => {
      this.currentAaskUserQuestionId = uuid()
      this.currentAskUserQuestionDraft = {
        type: type === 'single' ? 'single' : 'multiple',
        options: [],
      }
    })

    onAskUserQuestionEvent('ask-user-title', async ({ title }) => {
      // accumulate in memory only
      if (this.currentAskUserQuestionDraft) {
        this.currentAskUserQuestionDraft = { ...this.currentAskUserQuestionDraft, title }
      }
    })

    onAskUserQuestionEvent('ask-user-description', async ({ description }) => {
      // accumulate in memory only
      if (this.currentAskUserQuestionDraft) {
        this.currentAskUserQuestionDraft = { ...this.currentAskUserQuestionDraft, description }
      }
    })

    onAskUserQuestionEvent('ask-user-option', async ({ option }) => {
      // accumulate in memory only
      if (this.currentAskUserQuestionDraft) {
        this.currentAskUserQuestionDraft = {
          ...this.currentAskUserQuestionDraft,
          options: [...this.currentAskUserQuestionDraft.options, option],
        }
      }
    })

    onAskUserQuestionEvent('ask-user-complete', async ({ workflowId }) => {
      const time = Date.now()
      // insert complete question at once
      await db.insert(askUserQuestions).values({
        id: this.currentAaskUserQuestionId!,
        blockId: workflowId,
        completedGenerate: 'true',
        draftJson: JSON.stringify(this.currentAskUserQuestionDraft),
        createdAt: time,
        updatedAt: time,
      })
      this.currentAskUserQuestionDraft = null
      this.currentAaskUserQuestionId = null
    })
  }
}
