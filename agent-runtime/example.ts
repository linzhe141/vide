import OpenAI from 'openai'
import { Agent } from './core/agent'
import { DevConfig } from '@/dev.config'

const client = new OpenAI({
  apiKey: DevConfig.llm.apiKey,
  baseURL: DevConfig.llm.baseURL,
})

const messages = [
  // { role: 'user', content: '' },
  // {
  //   role: 'tool',
  //   tool_call_id: '',
  //   content: '',
  // },
]
async function* requestLLMHandle({ messages }) {
  console.log(JSON.stringify(messages))
  const stream = await client.chat.completions.create({
    messages: messages,
    model: DevConfig.llm.model,
    stream: true,
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              date: { type: 'string' },
            },
            required: ['city'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_current_time',
          description: 'Get current time',
        },
      },
    ],
  })

  let content = ''
  const toolCalls: any[] = []

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    const finishReason = chunk.choices[0].finish_reason
    if (delta?.content) {
      content += delta.content
      yield { content, finishReason }
    }

    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        if (!toolCalls[toolCall.index]) {
          toolCalls[toolCall.index] = {
            function: { arguments: '', name: '' },
            id: toolCall.id,
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
    yield { tool_calls: toolCalls.filter(Boolean) }
  }
}

async function main() {
  const agent = new Agent(requestLLMHandle)
  const input = '成都明天天气怎么样'
  agent.state = 'user-input'
  let state = {
    status: 'user-input',
  }

  let currentPayload = {
    messages: [{ role: 'user', content: input }],
  }
  while (state.status !== 'finished') {
    const result = await agent.run({ currentPayload })
    console.log(result)
    if (result.status === 'llm-result') {
      const llmResult = result.data

      const hasToolCalls = llmResult?.toolCalls.length
      if (hasToolCalls) {
        const firstToolCall = llmResult.toolCalls[0]
        const tool = () => {
          return '晴天12°'
        }
        currentPayload = {
          messages: [
            { role: 'user', content: input },
            {
              role: 'tool',
              tool_call_id: firstToolCall.id,
              content: tool(),
            },
          ],
        }
        agent.state = 'tool-result'
      }
    }
    state = result.status
  }
}

main()
