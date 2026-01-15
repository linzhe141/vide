import type { AppManager } from '@/electron/appManager'
import type { IpcMainService } from '../..'
import { ipcMainApi } from '../../api/ipcMain'
import OpenAI from 'openai'
import { DevConfig } from '@/dev.config'
import type { FinishReason, FnProcessLLMStream, Tool, ToolCall } from '@/agent/core/types'
import { Agent, AgentSession } from '@/agent/core/agent'
import { onLLMEvent, onToolEvent, onWorkflowEvent } from '@/agent/core/apiEvent'

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
  {
    name: 'get_normalize_time',
    type: 'function',
    function: {
      name: 'get_normalize_time',
      description:
        'Get normalized time power by dayjs, supporting semantic computation. DayJS knows the current time by default.',
    },
    async executor() {
      return `2026-11-12`
    },
  },
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
  constructor(private appManager: AppManager) {
    this.agent = new Agent({ processLLMStream, tools })
    this.registerIpcMainSenders()
  }

  registerIpcMainHandle() {
    ipcMainApi.handle('agent-create-session', () => {
      this.session = this.agent.createSession()
    })

    ipcMainApi.handle('agent-session-send', ({ input }) => {
      this.session?.send(input)
    })
  }

  registerIpcMainSenders() {
    onWorkflowEvent('workflow-start', (data) => {
      ipcMainApi.send('agent-workflow-start', data)
    })

    onLLMEvent('llm-delta', ({ content }) => {
      ipcMainApi.send('agent-llm-delta', content)
    })

    onLLMEvent('llm-tool-calls', (data) => {
      ipcMainApi.send('agent-llm-tool-calls', data)
    })

    onWorkflowEvent('workflow-wait-human-approve', () => {
      this.session?.humanApprove()
    })

    onToolEvent('tool-call-success', (data) => {
      ipcMainApi.send('agent-tool-call-success', data)
    })

    onWorkflowEvent('workflow-finished', (data) => {
      ipcMainApi.send('agent-workflow-finished', data)
    })
  }
}
