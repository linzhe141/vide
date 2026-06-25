import OpenAI from 'openai'
import type { ChatMessage, FinishReason, FnProcessLLMStream, ToolCall } from './types'
import { v4 as uuid } from 'uuid'
import { AgentSystemPrompt } from './prompt/system'
import { buildSkillsChatMessage } from './tools/skill'
import { AbortError } from './error'

let model: string = null!
export let llmClient: OpenAI = null!

export function createLLMClient(options: { apiKey: string; baseURL: string; model: string }) {
  llmClient = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  })
  model = options.model
}

export const processLLMStream: FnProcessLLMStream = async function* ({
  messages,
  tools,
  signal,
  onReasoningStart,
  onReasoningDelta,
  onReasoningEnd,
  onTextStart,
  onTextDelta,
  onTextEnd,
  onToolCallsStart,
  onToolCallName,
  onToolCallArguments,
  onToolCallsEnd,
}) {
  try {
    console.log('singal in processLLMStream', signal)
    const stream = llmClient.chat.completions.create(
      {
        messages: await buildChatMessages(messages),
        model,
        stream: true,
        tools,
        reasoning_effort: 'medium',
      },
      { signal }
    )
    
    let reasonContent = ''
    let content = ''
    const toolCalls: ToolCall[] = []
    let finishReason: FinishReason = null!

    const finishedToolCallName: { name: string; id: string }[] = []
    for await (const chunk of await stream) {
      const delta = chunk.choices[0]?.delta
      // console.log(JSON.stringify(delta, null, 2))
      const chunkFinishReason = chunk.choices[0].finish_reason
      if (chunkFinishReason) {
        console.log('\nchunkFinishReason===>', chunkFinishReason)
      }
      if (chunkFinishReason) {
        finishReason = chunkFinishReason as any
      }
      // @ts-expect-error support reason_content
      if (delta.reasoning_content) {
        if (reasonContent === '') {
          // just for ui
          onReasoningStart?.()
          console.log('onReasoningStart')
        }
        // @ts-expect-error support reason_content
        reasonContent += delta.reasoning_content
        // @ts-expect-error support reason_content just for ui
        onReasoningDelta?.({ content: reasonContent, delta: delta.reasoning_content })
        // @ts-expect-error support reason_content just for ui
        process.stdout.write(delta.reasoning_content)
      }

      if (delta?.content) {
        if (reasonContent) {
          onReasoningEnd?.(reasonContent)
          reasonContent = ''
          console.log()
        }
        if (content === '') {
          onTextStart?.()
          console.log('onTextStart')
        }
        content += delta.content
        onTextDelta?.({ content, delta: delta.content })
        process.stdout.write(delta.content)
        yield {
          content,
          delta: delta.content,
          finishReason: finishReason === 'tool_calls' ? 'tool_calls' : 'stop',
        }
      }

      if (chunkFinishReason === 'stop') {
        if (content) {
          onTextEnd?.(content)
          content = ''
          console.log()
        }
      }
      if (delta?.tool_calls) {
        // just for ui
        if (reasonContent) {
          onReasoningEnd?.(reasonContent)
          reasonContent = ''
          console.log()
        }
        if (content) {
          onTextEnd?.(content)
          content = ''
          console.log()
        }

        if (toolCalls.length === 0) {
          onToolCallsStart?.()
          console.log('onToolCallsStart')
        }
        for (const toolCall of delta.tool_calls) {
          if (!toolCalls[toolCall.index]) {
            toolCalls[toolCall.index] = {
              function: { arguments: '', name: '' },
              id: toolCall.id ?? uuid(),
              type: 'function',
              status: 'auto-approved'
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
              onToolCallName?.({ id, name: toolCallName })
            }
            toolCalls[toolCall.index].function.arguments += toolCall.function.arguments

            // just for ui
            onToolCallArguments?.({ id, arguments: toolCalls[toolCall.index].function.arguments })
          }
        }
      }
    }

    if (toolCalls.length > 0) {
      onToolCallsEnd?.(toolCalls.filter(Boolean))
      console.log(JSON.stringify(toolCalls.filter(Boolean), null, 2))
      yield {
        tool_calls: toolCalls.filter(Boolean),
        finishReason: 'tool_calls' as const,
      }
    }
  } catch (error) {
    console.error('Error in processLLMStream:', error)
    if (error instanceof OpenAI.APIUserAbortError && error.name === 'AbortError') {
      console.error('Stream was aborted by user')
      // 统一抛出 AbortError，方便上层捕获和处理
      throw new AbortError()
    }
    console.error('Error in processLLMStream:', error)
    // 其他错误继续往上抛
    throw error
  }
}

export async function buildChatMessages(messages: ChatMessage[]) {
  const skillsChatMessage = await buildSkillsChatMessage()
  // console.log(skillsChatMessage)
  const chatMessages: ChatMessage[] = [
    {
      role: 'system',
      content: AgentSystemPrompt,
    },
  ]
  if (skillsChatMessage) {
    chatMessages.push(skillsChatMessage)
  }
  chatMessages.push(...messages)

  return chatMessages
}
