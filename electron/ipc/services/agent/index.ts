import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import OpenAI from 'openai'
import { DevConfig } from '@/dev.config'
import type {
  AssistantChatMessage,
  ChatMessage,
  FinishReason,
  FnProcessLLMStream,
  Tool,
  ToolCall,
  ToolChatMessage,
} from '@/agent/core/types'
import { Agent, AgentSession } from '@/agent/core/agent'
import { onLLMEvent, onToolEvent, onWorkflowEvent } from '@/agent/core/apiEvent'
import { logger } from '@/electron/logger'
import { getNormalizeTime } from './tools/getNormalizeTime'
import { fileSystem } from './tools/fileSystem'
import { db } from '@/electron/databaseManager'
import { threadMessages, threads } from '@/db/schema'
import { v4 as uuid } from 'uuid'
import { eq } from 'drizzle-orm'

const client = new OpenAI({
  apiKey: DevConfig.llm.apiKey,
  baseURL: DevConfig.llm.baseURL,
})

const tools: Tool[] = [
  {
    name: 'get_weather',
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather basic on city and normalized date (like 2000-10-10)',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['city'],
      },
    },
    async executor() {
      const city = '北京'
      const date = '2026-01-11'
      return `city: ${city} date:${date} , 天气：冬雨，湿度高，注意保暖  温度：12°`
    },
  },
  fileSystem,
  getNormalizeTime,
]

const processLLMStream: FnProcessLLMStream = async function* ({ messages, tools, signal }) {
  const stream = await client.chat.completions.create(
    {
      messages,
      model: DevConfig.llm.model,
      stream: true,
      tools,
    },
    { signal }
  )

  let content = ''
  const toolCalls: ToolCall[] = []
  let finishReason: FinishReason = null!
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    const chunkFinishReason = chunk.choices[0].finish_reason
    if (chunkFinishReason) {
      finishReason = chunkFinishReason as any
    }
    if (delta?.content) {
      content += delta.content
      yield {
        content,
        delta: delta.content,
        finishReason: finishReason === 'tool_calls' ? 'tool_calls' : 'stop',
      }
    }

    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        if (!toolCalls[toolCall.index]) {
          toolCalls[toolCall.index] = {
            function: { arguments: '', name: '' },
            id: toolCall.id ?? String(Date.now()),
            type: 'function',
          }
        }
        if (toolCall.function?.name) {
          toolCalls[toolCall.index].function.name += toolCall.function.name
        }
        if (toolCall.function?.arguments) {
          toolCalls[toolCall.index].function.arguments += toolCall.function.arguments
        }
      }
    }
  }

  if (toolCalls.length > 0) {
    yield {
      tool_calls: toolCalls.filter(Boolean),
      finishReason: 'tool_calls' as const,
    }
  }
}
export class AgentIpcMainService implements IpcMainService {
  agent: Agent = null!
  session: AgentSession | null = null
  currentAssistantMessageId: string | null = null
  currentToolcallsMessageId: string | null = null

  constructor(private appManager: AppManager) {
    this.agent = new Agent({ processLLMStream, tools })
    this.registerIpcMainSenders()
  }

  registerIpcMainHandle() {
    ipcMainApi.handle('agent-create-session', async () => {
      this.session = this.agent.createSession()
      logger.info('agent-create-session ', this.session.thread.id)

      const sessionId = this.session.thread.id

      const time = Date.now()
      await db.insert(threads).values({
        id: sessionId,
        title: '',
        createdAt: time,
        updatedAt: time,
      })

      return sessionId
    })

    ipcMainApi.handle('agent-session-send', async ({ input }) => {
      logger.info('agent-session-send ', input)

      this.session!.send(input)
      const sessionId = this.session!.thread.id
      const time = Date.now()

      await db.insert(threadMessages).values({
        id: uuid(),
        role: 'user',
        threadId: sessionId,
        content: input,
        createdAt: time,
        payload: '',
      })
    })

    ipcMainApi.handle('agent-human-approved', () => {
      logger.info('agent-human-approved ')

      this.session!.humanApprove()
    })

    ipcMainApi.handle('agent-change-session', async ({ threadId }) => {
      // TODO
      // if no restore

      const toLLMmessages: ChatMessage[] = []
      const rows = await db
        .select()
        .from(threadMessages)
        .where(eq(threadMessages.threadId, threadId))

      let assistantMessage: AssistantChatMessage | null = null
      for (const i of rows) {
        switch (i.role) {
          case 'user': {
            toLLMmessages.push({
              role: 'user',
              content: i.content!,
            })
            break
          }
          case 'assistant': {
            assistantMessage = {
              role: 'assistant',
              content: i.content!,
            }
            toLLMmessages.push(assistantMessage)
            break
          }

          case 'tool-call': {
            const toolCalls = JSON.parse(i.payload!).toolCalls as Array<
              ToolCall & { result?: ToolChatMessage }
            >
            if (assistantMessage) {
              assistantMessage.tool_calls = toolCalls.map((i) => ({
                function: i.function,
                id: i.id,
                type: i.type,
              }))

              for (const toolCall of toolCalls) {
                const toolMessage: ToolChatMessage = {
                  role: 'tool',
                  content: JSON.stringify(toolCall.result),
                  tool_call_id: toolCall.id,
                }
                toLLMmessages.push(toolMessage)
              }
            }

            break
          }
        }
      }
      this.session = this.agent.restoreSession(threadId, toLLMmessages)
    })
  }

  registerIpcMainSenders() {
    onWorkflowEvent('workflow-start', (data) => {
      logger.info('workflow-start')
      ipcMainApi.send('agent-workflow-start', data)
    })

    onLLMEvent('llm-start', async () => {
      logger.info('llm-start')

      ipcMainApi.send('agent-llm-start')

      this.currentAssistantMessageId = uuid()
      await db.insert(threadMessages).values({
        id: this.currentAssistantMessageId,
        threadId: this.session!.thread.id,
        role: 'assistant',
        content: '',
        payload: '',
        createdAt: Date.now(),
      })
    })

    onLLMEvent('llm-delta', async ({ content, delta }) => {
      logger.info('llm-delta', delta)

      ipcMainApi.send('agent-llm-delta', { content, delta })

      await db
        .update(threadMessages)
        .set({
          content: content,
        })
        .where(eq(threadMessages.id, this.currentAssistantMessageId!))
    })

    onLLMEvent('llm-tool-calls', async (data) => {
      logger.info('llm-tool-calls', JSON.stringify(data, null, 2))

      ipcMainApi.send('agent-llm-tool-calls', data)

      this.currentToolcallsMessageId = uuid()
      await db.insert(threadMessages).values({
        id: this.currentToolcallsMessageId!,
        threadId: this.session!.thread.id,
        role: 'tool-call',
        content: '',
        payload: JSON.stringify(data),
        createdAt: Date.now(),
      })
      console.log('yyyyyyyy')
    })

    onLLMEvent('llm-end', ({ finishReason }) => {
      logger.info('llm-end', finishReason)

      ipcMainApi.send('agent-llm-end', finishReason)
    })

    onLLMEvent('llm-result', (message) => {
      logger.info('llm-result')

      ipcMainApi.send('agent-llm-result', message)
    })

    onLLMEvent('llm-error', (error) => {
      logger.info('llm-error', error)

      ipcMainApi.send('agent-llm-error', error)
    })

    onLLMEvent('llm-aborted', () => {
      logger.info('llm-aborted')

      ipcMainApi.send('agent-llm-aborted')
    })

    onToolEvent('tool-call-start', (data) => {
      logger.info('tool-call-start')

      ipcMainApi.send('agent-tool-call-start', data)
    })

    onToolEvent('tool-call-success', async (data) => {
      logger.info('tool-call-success')

      ipcMainApi.send('agent-tool-call-success', data)

      const toolCallId = data.id
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
                  return { ...i, result: data.result }
                }
                return i
              }),
            }),
          })
          .where(eq(threadMessages.id, this.currentToolcallsMessageId!))
      }
    })

    onToolEvent('tool-call-error', async (data) => {
      logger.info('tool-call-error')

      ipcMainApi.send('agent-tool-call-error', data)

      const toolCallId = data.id
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
                  return { ...i, result: data.error }
                }
                return i
              }),
            }),
          })
          .where(eq(threadMessages.id, this.currentToolcallsMessageId!))
      }
    })

    onWorkflowEvent('workflow-finished', (data) => {
      logger.info('workflow-finished')

      ipcMainApi.send('agent-workflow-finished', data)
    })

    onWorkflowEvent('workflow-wait-human-approve', () => {
      logger.info('workflow-wait-human-approve')

      ipcMainApi.send('agent-workflow-wait-human-approve', {
        threadId: this.session!.thread.id,
      })
    })

    onWorkflowEvent('workflow-error', async (data) => {
      logger.info('workflow-error')

      ipcMainApi.send('agent-workflow-error', data)

      await db.insert(threadMessages).values({
        id: uuid(),
        threadId: this.session!.thread.id,
        role: 'error',
        content: '',
        payload: JSON.stringify(data.error),
        createdAt: Date.now(),
      })
    })
  }
}
