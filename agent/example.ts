import { type Tool, type FinishReason, type ToolCall, type FnProcessLLMStream } from './core/types'

import { DevConfig } from '@/dev.config'
import OpenAI from 'openai'
import { Agent, AgentSession } from './core/agent'
import { onLLMEvent, onToolEvent, onWorkflowEvent } from './core/apiEvent'

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

async function main() {
  const agent = new Agent({ processLLMStream, tools })
  const session = agent.createSession()

  session.setSessionSystemPrompt('使用小红书风格回复')
  setupEvents(session)
  // onWorkflowEvent('workflow-aborted', ({ threadId }) => {
  //   console.log('workflow-aborted=>', threadId)
  // })
  // onWorkflowEvent('workflow-wait-human-approve', () => {
  //   // session.abort()
  // })
  // onLLMEvent('llm-delta', ({ content, delta }) => {
  //   process.stdout.write(delta)
  // })
  await session.send('hello 介绍下你自己')
  console.log('\n==============================')
  await session.send('那北京下个星期一的天气怎么样')
}

function setupEvents(session: AgentSession) {
  onWorkflowEvent('workflow-start', ({ threadId, input }) => {
    console.log('> workflow-start ' + threadId)
    console.log('> user input ' + input)
  })
  onWorkflowEvent('workflow-finished', ({ threadId }) => {
    console.log('> workflow-finished ' + threadId)
    console.log()
  })
  onWorkflowEvent('workflow-wait-human-approve', async () => {
    console.log('> workflow-wait-human-approve')
    await session.humanApprove()
    console.log('> humanApprove')
  })

  onLLMEvent('llm-start', () => {
    console.log('> llm-start')
  })
  onLLMEvent('llm-delta', ({ delta }) => {
    process.stdout.write(delta)
  })
  onLLMEvent('llm-tool-calls', ({ toolCalls }) => {
    console.log()
    console.log(JSON.stringify(toolCalls, null, 4))
    console.log()
  })
  onLLMEvent('llm-end', ({ finishReason }) => {
    console.log()
    console.log('> llm-end ' + finishReason)
    console.log()
  })

  onToolEvent('tool-call-success', ({ toolName, result }) => {
    console.log(`> ${toolName} tool result`)
    console.log(JSON.stringify(result, null, 4))
  })
}
main().then(() => {
  console.log()
  console.log('> main end!')
})
