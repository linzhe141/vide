import OpenAI, { APIPromise } from 'openai'
import type { FinishReason, ToolCall } from './messages'
import type { Stream } from 'openai/core/streaming.js'
import { v4 as uuid } from 'uuid'

type LLMStream = APIPromise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk>>
type StreamContentChunk = {
  content: string
  delta: string
  finishReason?: FinishReason
}

type StreamToolCallsChunk = {
  tool_calls: ToolCall[]
  finishReason: 'tool_calls'
}

type FnProcessLLMStream = (
  stream: LLMStream,
  events: {
    onReasoningStart?: () => void
    onReasoningDelta?: (chunk: { delta: string; content: string }) => void
    onReasoningEnd?: (content: string) => void

    onTextStart?: () => void
    onTextDelta?: (chunk: { delta: string; content: string }) => void
    onTextEnd?: (content: string) => void

    onToolCallsStart?: () => void
    onToolCallName?: (data: { id: string; name: string }) => void
    onToolCallArguments?: (data: { id: string; arguments: string }) => void
    onToolCallsEnd?: (toolCalls: ToolCall[]) => Promise<ToolCall[]>
  }
) => AsyncGenerator<StreamContentChunk | StreamToolCallsChunk>

export const processLLMStream: FnProcessLLMStream = async function* (
  stream,
  {
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
  }
) {
  let reasonContent = ''
  let content = ''
  let toolCalls: ToolCall[] = []
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
            status: 'auto-approved',
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
    if (onToolCallsEnd) {
      toolCalls = await onToolCallsEnd(toolCalls.filter(Boolean))
    }
    console.log(JSON.stringify(toolCalls.filter(Boolean), null, 2))
    yield {
      tool_calls: toolCalls.filter(Boolean),
      finishReason: 'tool_calls' as const,
    }
  }
}
