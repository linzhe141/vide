import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
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
import { fileSystem } from './tools/fileRead'
import { fsCreateFile } from './tools/fileWrite'
import { threadMessages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@/electron/databaseManager'
import type { ThreadMessageRowDto } from '../../api/channels'
import { ThreadMessageRole } from '@/types'
import { settingsStore } from '@/electron/store/settingsStore'

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
  fsCreateFile,
  getNormalizeTime,
]

export class AgentIpcMainService implements IpcMainService {
  agent: Agent = null!
  session: AgentSession | null = null

  constructor(private appManager: AppManager) {
    const getLLMClient = this.appManager.agentManager.getLLMClient.bind(
      this.appManager.agentManager
    )

    const threadsManager = this.appManager.threadsManager

    const processLLMStream: FnProcessLLMStream = async function* ({ messages, tools, signal }) {
      const stream = await getLLMClient().chat.completions.create(
        {
          messages,
          model: settingsStore.get('llmConfig').model,
          stream: true,
          tools,
        },
        { signal }
      )

      let reasonContent = ''
      let content = ''
      const toolCalls: ToolCall[] = []
      let finishReason: FinishReason = null!

      const finishedToolCallName: { name: string; id: string }[] = []
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        const chunkFinishReason = chunk.choices[0].finish_reason
        if (chunkFinishReason) {
          finishReason = chunkFinishReason as any
        }
        // @ts-expect-error support reason_content
        if (delta.reasoning_content) {
          if (reasonContent === '') {
            // just for ui
            ipcMainApi.send('agent-llm-reasoning-start')
            threadsManager.addReasonMessage()
          }
          // @ts-expect-error support reason_content
          reasonContent += delta.reasoning_content
          // just for ui
          ipcMainApi.send('agent-llm-reasoning-delta', { reasonContent })
          threadsManager.updateReasonMessage({ reasonContent })
        }

        if (delta?.content) {
          if (reasonContent) {
            ipcMainApi.send('agent-llm-reasoning-end')
            reasonContent = ''
          }

          content += delta.content
          yield {
            content,
            delta: delta.content,
            finishReason: finishReason === 'tool_calls' ? 'tool_calls' : 'stop',
          }
        }

        if (delta?.tool_calls) {
          // just for ui
          if (reasonContent) {
            ipcMainApi.send('agent-llm-reasoning-end')
            reasonContent = ''
          }
          ipcMainApi.send('agent-llm-tool-calls-start')

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
              const toolCallName = toolCalls[toolCall.index].function.name
              const id = toolCalls[toolCall.index].id
              if (!finishedToolCallName.find((i) => i.id === id)) {
                finishedToolCallName.push({ name: toolCallName, id })

                // just for ui
                ipcMainApi.send('agent-llm-tool-call-name', { id, name: toolCallName })
              }
              toolCalls[toolCall.index].function.arguments += toolCall.function.arguments

              // just for ui
              ipcMainApi.send('agent-llm-tool-call-arguments', {
                id,
                arguments: toolCalls[toolCall.index].function.arguments,
              })
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

    this.agent = new Agent({ processLLMStream, tools })
    this.registerIpcMainSenders()
  }

  registerIpcMainHandle() {
    ipcMainApi.handle('agent-create-session', async () => {
      this.session = this.agent.createSession()
      logger.info('agent-create-session ', this.session.thread.id)

      const sessionId = this.session.thread.id
      return sessionId
    })

    ipcMainApi.handle('agent-session-send', async ({ input }) => {
      logger.info('agent-session-send ', input)

      this.session!.send(input)
    })

    ipcMainApi.handle('agent-human-approved', () => {
      logger.info('agent-human-approved ')

      this.session!.humanApprove()
    })

    ipcMainApi.handle('agent-workflow-abort', () => {
      logger.info('agent-workflow-abort')

      this.session!.humanReject()
    })

    ipcMainApi.handle('agent-change-session', async ({ threadId }) => {
      // TODO
      // if no restore

      const toLLMmessages: ChatMessage[] = []
      const rows = (await db
        .select()
        .from(threadMessages)
        .where(eq(threadMessages.threadId, threadId))) as ThreadMessageRowDto[]

      let assistantMessage: AssistantChatMessage | null = null
      for (const i of rows) {
        switch (i.role) {
          case ThreadMessageRole.User: {
            toLLMmessages.push({
              role: 'user',
              content: i.content!,
            })
            break
          }
          case ThreadMessageRole.AssistantText: {
            assistantMessage = {
              role: 'assistant',
              content: i.content!,
            }
            toLLMmessages.push(assistantMessage)
            break
          }

          case ThreadMessageRole.ToolCalls: {
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
    })

    onLLMEvent('llm-text-delta', async ({ content, delta }) => {
      logger.info('llm-text-delta', delta)

      ipcMainApi.send('agent-llm-text-delta', { content, delta })
    })

    onLLMEvent('llm-tool-calls', async (data) => {
      logger.info('llm-tool-calls', JSON.stringify(data, null, 2))

      ipcMainApi.send('agent-llm-tool-calls', data)
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
    })

    onToolEvent('tool-call-error', async (data) => {
      logger.info('tool-call-error')

      ipcMainApi.send('agent-tool-call-error', data)
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
    })
  }
}
