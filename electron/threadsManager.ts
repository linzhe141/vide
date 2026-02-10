import type { AppManager } from './appManager'
import { onAgentEvent, onLLMEvent, onToolEvent, onWorkflowEvent } from '@/agent/core/apiEvent'
import { v4 as uuid } from 'uuid'
import { db } from './databaseManager'
import { threadMessages, threads } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { CallToolStepPayload, ToolCall, ToolChatMessage } from '@/agent/core/types'
import { ThreadMessageRole } from '@/types'
import { settingsStore } from './store/settingsStore'

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
        id: data.threadId,
        title: '',
        createdAt: time,
        updatedAt: time,
      })
    })

    onWorkflowEvent('workflow-start', async ({ threadId, input }) => {
      this.currentThreadId = threadId

      await db.insert(threadMessages).values({
        id: uuid(),
        role: ThreadMessageRole.User,
        threadId: threadId,
        content: input,
        createdAt: Date.now(),
        payload: '',
      })

      const rows = await db.select().from(threads).where(eq(threads.id, this.currentThreadId))
      if (rows.length && !rows[0].title) {
        const userInput = (
          await db.select().from(threadMessages).where(eq(threadMessages.threadId, threadId))
        )
          .filter((i) => i.role === ThreadMessageRole.User)
          .map((i) => i.content)
          .join('\n')

        const client = this.app.agentManager.getLLMClient()
        const result = await client.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `
You are an AI assistant that generates concise conversation titles.

Rules:
- Only use the user's messages as context.
- Generate ONE short title that summarizes the conversation topic.
- Title length: 4–12 words (or <= 20 characters if Chinese).
- No quotation marks.
- No punctuation at the end.
- No explanations.
- No markdown.
- Output title only.
      `.trim(),
            },
            {
              role: 'user',
              content: `
Here are the user's messages in this conversation:

${userInput}

Generate the conversation title.
      `.trim(),
            },
          ],
          model: settingsStore.get('llmConfig').model,
        })
        await db
          .update(threads)
          .set({
            title: result.choices[0].message.content,
          })
          .where(eq(threads.id, this.currentThreadId))
      }
    })

    onLLMEvent('llm-text-start', async () => {
      this.currentAssistantMessageId = uuid()

      await db.insert(threadMessages).values({
        id: this.currentAssistantMessageId,
        threadId: this.currentThreadId!,
        role: ThreadMessageRole.AssistantText,
        content: '',
        payload: '',
        createdAt: Date.now(),
      })
    })

    onLLMEvent('llm-text-delta', async ({ content }) => {
      await db
        .update(threadMessages)
        .set({
          content: content,
        })
        .where(eq(threadMessages.id, this.currentAssistantMessageId!))
    })

    onLLMEvent('llm-tool-calls', async (data) => {
      this.currentToolcallsMessageId = uuid()
      const payload = {
        toolCalls: data.toolCalls.map((i) => {
          return { ...i, status: 'pending' } as ToolCall & {
            result?: string
            status: 'pending' | 'approve' | 'reject'
          }
        }),
      }
      await db.insert(threadMessages).values({
        id: this.currentToolcallsMessageId!,
        threadId: this.currentThreadId!,
        role: ThreadMessageRole.ToolCalls,
        content: '',
        payload: JSON.stringify(payload),
        createdAt: Date.now(),
      })
    })

    onWorkflowEvent('workflow-wait-human-approve', async (data) => {
      this.currentPendingToolCall = data
    })

    onWorkflowEvent('workflow-tool-call-approved', async () => {
      const pendingToolCall = this.currentPendingToolCall
      const toolCallId = pendingToolCall!.payload.toolCalls[pendingToolCall!.payload.index].id
      this.updateToolCallStatus(toolCallId, 'approve')
    })

    onWorkflowEvent('workflow-tool-call-rejected', async () => {
      const pendingToolCall = this.currentPendingToolCall
      const toolCallId = pendingToolCall!.payload.toolCalls[pendingToolCall!.payload.index].id
      this.updateToolCallStatus(toolCallId, 'reject')
    })

    onToolEvent('tool-call-reject', async (data) => {
      this.updateSingleToolCallResult(data)
    })

    onToolEvent('tool-call-success', async (data) => {
      this.updateSingleToolCallResult(data)
    })

    onToolEvent('tool-call-error', async (data) => {
      this.updateSingleToolCallResult(data)
    })

    onWorkflowEvent('workflow-error', async (data) => {
      await db.insert(threadMessages).values({
        id: uuid(),
        threadId: this.currentThreadId!,
        role: ThreadMessageRole.Error,
        content: '',
        payload: JSON.stringify(data.error),
        createdAt: Date.now(),
      })
    })
  }

  async updateSingleToolCallResult(
    data:
      | { id: string; toolName: string; result: any }
      | { id: string; toolName: string; error: any }
      | { id: string; toolName: string; reject: any }
  ) {
    const toolCallId = data.id
    const updatedContent =
      'result' in data ? data.result : 'error' in data ? data.error : data.reject

    const isReject = 'reject' in data
    const rows = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.id, this.currentToolcallsMessageId!))

    if (rows.length) {
      const target = rows[0]
      const toolCalls = JSON.parse(target.payload!).toolCalls as Array<
        ToolCall & { result?: ToolChatMessage }
      >
      await db
        .update(threadMessages)
        .set({
          payload: JSON.stringify({
            toolCalls: toolCalls.map((i) => {
              if (i.id === toolCallId) {
                // 无论 toolcall 成功与否都是 approve
                return {
                  ...i,
                  result: updatedContent,
                  status: isReject ? 'reject' : 'approve',
                } satisfies ApproveToolCall
              }
              return i
            }),
          }),
        })
        .where(eq(threadMessages.id, this.currentToolcallsMessageId!))
    }
  }

  async addReasonMessage() {
    this.currentAssistantReasonMessageId = uuid()
    await db.insert(threadMessages).values({
      id: this.currentAssistantReasonMessageId,
      role: ThreadMessageRole.AssistantReason,
      threadId: this.currentThreadId!,
      content: '',
      payload: '',
      createdAt: Date.now(),
    })
  }
  async updateReasonMessage({ reasonContent }: { reasonContent: string }) {
    await db
      .update(threadMessages)
      .set({ content: reasonContent })
      .where(eq(threadMessages.id, this.currentAssistantReasonMessageId!))
  }

  async updateToolCallStatus(toolCallId: string, status: 'approve' | 'reject') {
    const rows = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.id, this.currentToolcallsMessageId!))

    if (rows.length) {
      const target = rows[0]
      const toolCalls = JSON.parse(target.payload!).toolCalls as Array<
        ToolCall & { result?: ToolChatMessage; status: 'pending' | 'approve' | 'reject' }
      >
      await db
        .update(threadMessages)
        .set({
          payload: JSON.stringify({
            toolCalls: toolCalls.map((i) => {
              if (i.id === toolCallId) {
                // 无论toolcall 成功与否都是 approve
                return {
                  ...i,
                  result: '',
                  status,
                } satisfies ApproveToolCall
              }
              return i
            }),
          }),
        })
        .where(eq(threadMessages.id, this.currentToolcallsMessageId!))
    }
  }
}
