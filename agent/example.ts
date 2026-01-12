import {
  type Tool,
  type FinishReason,
  type ToolCall,
  type FnProcessLLMStream,
} from './core/types'

import { DevConfig } from '@/dev.config'
import OpenAI from 'openai'
import { Agent } from './core/agent'

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
      description:
        'Get current weather basic on city and normalized date (like 2000-10-10)',
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
      const city = '成都'
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

const processLLMStream: FnProcessLLMStream = async function* ({
  messages,
  tools,
}) {
  console.log(JSON.stringify(messages, null, 4))
  const stream = await client.chat.completions.create({
    messages,
    model: DevConfig.llm.model,
    stream: true,
    tools,
  })

  let content = ''
  const toolCalls: ToolCall[] = []
  let finishReason: FinishReason = null
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    const chunkFinishReason = chunk.choices[0].finish_reason
    if (chunkFinishReason) {
      finishReason = chunkFinishReason

      console.log('chunk finishReason -->', finishReason)
    }
    if (delta?.content) {
      content += delta.content
      yield {
        content,
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
          toolCalls[toolCall.index].function.arguments +=
            toolCall.function.arguments
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
  const input = '成都大后天的天气怎么样，温度怎么样，天气如何'
  const agent = new Agent({ processLLMStream, tools })
  agent.run(input)
}

main()
