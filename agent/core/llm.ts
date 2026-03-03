import OpenAI from 'openai'
import type { ChatMessage, FinishReason, FnProcessLLMStream, ToolCall } from './types'
import { v4 as uuid } from 'uuid'

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
  const stream = await llmClient.chat.completions.create(
    {
      messages,
      model,
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
        onReasoningStart?.()
      }
      // @ts-expect-error support reason_content
      reasonContent += delta.reasoning_content
      // @ts-expect-error support reason_content just for ui
      onReasoningDelta?.({ content: reasonContent, delta: delta.reasoning_content })
    }

    if (delta?.content) {
      if (reasonContent) {
        onReasoningEnd?.()
        reasonContent = ''
      }
      if (content === '') {
        onTextStart?.()
      }
      content += delta.content
      onTextDelta?.({ content, delta: delta.content })
      yield {
        content,
        delta: delta.content,
        finishReason: finishReason === 'tool_calls' ? 'tool_calls' : 'stop',
      }
    }

    if (delta?.tool_calls) {
      // just for ui
      if (reasonContent) {
        onReasoningEnd?.()
        reasonContent = ''
      }
      if (content) {
        content = ''
        onTextEnd?.()
      }

      if (toolCalls.length === 0) {
        onToolCallsStart?.()
      }
      for (const toolCall of delta.tool_calls) {
        if (!toolCalls[toolCall.index]) {
          toolCalls[toolCall.index] = {
            function: { arguments: '', name: '' },
            id: toolCall.id ?? uuid(),
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
    yield {
      tool_calls: toolCalls.filter(Boolean),
      finishReason: 'tool_calls' as const,
    }
  }
}

export const generateJSON = async (messages: ChatMessage[]) => {
  const completion = await llmClient.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(completion.choices[0].message.content || '{}')
  return result
}
