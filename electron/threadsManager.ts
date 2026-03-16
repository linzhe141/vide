import type { AppManager } from './appManager'
import { onAgentEvent, onWorkflowEvent } from '@/agent/core/apiEvent'
import { v4 as uuid } from 'uuid'
import { db } from './databaseManager'
import { threads, threadWorkflowBlockMessages, threadWorkflowBlocks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { CallToolStepPayload, ToolCall } from '@/agent/core/types'
import { ThreadMessageRole } from '@/types'
import type { WorkflowState } from '@/agent/core/workflow'

export type ApproveToolCall = ToolCall & {
  status: 'pending' | 'approve' | 'reject'
  result?: string
}
export class ThreadsManager {
  currentThreadId: string | null = ''
  currentAssistantReasonMessageId: string | null = null
  currentAssistantMessageId: string | null = null
  currentToolcallsMessageId: string | null = null

  currentPendingToolCall: { threadId: string; payload: CallToolStepPayload } | null = null
  constructor(private app: AppManager) {}

  init() {
    this.setupAgentEvents()
  }

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
      const status: WorkflowState = 'INPUT'
      // insert workflow block
      await db.insert(threadWorkflowBlocks).values({
        id: workflowId,
        threadId: sessionId,
        input,
        status,
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
    onWorkflowEvent('workflow-llm-start', async ({ ctx: { workflowId } }) => {
      const status: WorkflowState = 'CALL_LLM'
      await db
        .update(threadWorkflowBlocks)
        .set({
          status,
        })
        .where(eq(threadWorkflowBlocks.id, workflowId))
    })

    onWorkflowEvent('workflow-llm-reasoning-start', async ({ ctx: { workflowId } }) => {
      this.currentAssistantReasonMessageId = uuid()
      await db.insert(threadWorkflowBlockMessages).values({
        id: this.currentAssistantReasonMessageId,
        blockId: workflowId,
        role: ThreadMessageRole.AssistantReason,
        content: '',
        payload: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    onWorkflowEvent('workflow-llm-reasoning-delta', async ({ chunk }) => {
      await db
        .update(threadWorkflowBlockMessages)
        .set({
          content: chunk.content,
        })
        .where(eq(threadWorkflowBlockMessages.id, this.currentAssistantReasonMessageId!))
    })

    onWorkflowEvent('workflow-llm-text-start', async ({ ctx: { workflowId } }) => {
      this.currentAssistantMessageId = uuid()
      await db.insert(threadWorkflowBlockMessages).values({
        id: this.currentAssistantMessageId,
        blockId: workflowId,
        role: ThreadMessageRole.AssistantText,
        content: '',
        payload: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    onWorkflowEvent('workflow-llm-text-delta', async ({ chunk }) => {
      await db
        .update(threadWorkflowBlockMessages)
        .set({
          content: chunk.content,
        })
        .where(eq(threadWorkflowBlockMessages.id, this.currentAssistantMessageId!))
    })

    // onLLMEvent('llm-tool-calls', async (data) => {
    //   this.currentToolcallsMessageId = uuid()
    //   const payload = {
    //     toolCalls: data.toolCalls.map((i) => {
    //       return { ...i, status: 'pending' } as ToolCall & {
    //         result?: string
    //         status: 'pending' | 'approve' | 'reject'
    //       }
    //     }),
    //   }
    //   await db.insert(threadMessages).values({
    //     id: this.currentToolcallsMessageId!,
    //     threadId: this.currentThreadId!,
    //     role: ThreadMessageRole.ToolCalls,
    //     content: '',
    //     payload: JSON.stringify(payload),
    //     createdAt: Date.now(),
    //   })
    // })
    // onWorkflowEvent('workflow-wait-human-approve', async (data) => {
    //   this.currentPendingToolCall = data
    // })
    // onWorkflowEvent('workflow-tool-call-approved', async () => {
    //   const pendingToolCall = this.currentPendingToolCall
    //   const toolCallId = pendingToolCall!.payload.toolCalls[pendingToolCall!.payload.index].id
    //   this.updateToolCallStatus(toolCallId, 'approve')
    // })
    // onWorkflowEvent('workflow-tool-call-rejected', async () => {
    //   const pendingToolCall = this.currentPendingToolCall
    //   const toolCallId = pendingToolCall!.payload.toolCalls[pendingToolCall!.payload.index].id
    //   this.updateToolCallStatus(toolCallId, 'reject')
    // })
    // onToolEvent('tool-call-reject', async (data) => {
    //   this.updateSingleToolCallResult(data)
    // })
    // onToolEvent('tool-call-success', async (data) => {
    //   this.updateSingleToolCallResult(data)
    // })
    // onToolEvent('tool-call-error', async (data) => {
    //   this.updateSingleToolCallResult(data)
    // })
    // onWorkflowEvent('workflow-error', async (data) => {
    //   await db.insert(threadMessages).values({
    //     id: uuid(),
    //     threadId: this.currentThreadId!,
    //     role: ThreadMessageRole.Error,
    //     content: '',
    //     payload: JSON.stringify(data.error),
    //     createdAt: Date.now(),
    //   })
    // })
  }
}
