import { llmEvent } from '../event'
import type { ChatMessage, FinishReason, FnProcessLLMStream, Tool, ToolCall } from '../types'

export class LLMService {
  constructor(
    private processLLMStream: FnProcessLLMStream,
    private tools: Tool[]
  ) {}

  async call(messages: ChatMessage[], signal: AbortSignal) {
    llmEvent.emit('llm-start', { messages })

    let content = ''
    let toolCalls: ToolCall[] = []
    let finishReason: FinishReason = null!

    const llmAbortController = new AbortController()
    signal.addEventListener('abort', () => {
      llmAbortController.abort()
    })

    try {
      for await (const chunk of this.processLLMStream({
        messages,
        tools: this.tools,
        signal: llmAbortController.signal,
      })) {
        if ('content' in chunk && chunk.content) {
          llmEvent.emit('llm-delta', { delta: chunk.delta, content: chunk.content })

          content = chunk.content
        }

        if ('tool_calls' in chunk && chunk.tool_calls) {
          llmEvent.emit('llm-tool-calls', { toolCalls: chunk.tool_calls })

          toolCalls = chunk.tool_calls
        }
        if (chunk.finishReason) {
          finishReason = chunk.finishReason
        }
      }

      finishReason = finishReason ?? 'stop'

      llmEvent.emit('llm-end', { finishReason })
      llmEvent.emit('llm-result', { role: 'assistant', content, tool_calls: toolCalls })

      return { content, toolCalls, finishReason: finishReason ?? 'stop' }
    } catch (error: any) {
      if (llmAbortController.signal.aborted) {
        llmEvent.emit('llm-aborted')
        throw error
      }
      llmEvent.emit('llm-error', { error })
      throw error
    }
  }
}
