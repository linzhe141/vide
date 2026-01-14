import { llmEvent } from '../event'
import type { ChatMessage, FinishReason, FnProcessLLMStream, Tool, ToolCall } from '../types'

export class LLMService {
  private event = llmEvent
  constructor(
    private processLLMStream: FnProcessLLMStream,
    private tools: Tool[]
  ) {}

  async call(messages: ChatMessage[]) {
    let content = ''
    let toolCalls: ToolCall[] = []
    let finishReason: FinishReason = null
    for await (const chunk of this.processLLMStream({
      messages,
      tools: this.tools,
    })) {
      if ('content' in chunk && chunk.content) {
        this.event.emit('llm:request:delta', {
          delta: chunk.delta,
          content: chunk.content,
        })

        content = chunk.content
      }

      if ('tool_calls' in chunk && chunk.tool_calls) {
        this.event.emit('llm:request:tool-calls', {
          toolCalls: chunk.tool_calls,
        })

        toolCalls = chunk.tool_calls
      }
      if (chunk.finishReason) {
        finishReason = chunk.finishReason
      }
    }

    finishReason = finishReason ?? 'stop'
    return {
      content,
      toolCalls,
      finishReason: finishReason ?? 'stop',
    }
  }
}
