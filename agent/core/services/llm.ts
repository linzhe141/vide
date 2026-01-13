import type {
  ChatMessage,
  FinishReason,
  FnProcessLLMStream,
  Tool,
  ToolCall,
} from '../types'

export class LLMService {
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
        content = chunk.content
      }

      if ('tool_calls' in chunk && chunk.tool_calls) {
        toolCalls = chunk.tool_calls
      }
      if (chunk.finishReason) {
        finishReason = chunk.finishReason
      }
    }
    console.log('llm-content', content)
    console.log('llm-toolCalls', JSON.stringify(toolCalls))
    console.log('llm-finish-reason-->', finishReason)
    finishReason = finishReason ?? 'stop'
    return {
      content,
      toolCalls,
      finishReason: finishReason ?? 'stop',
    }
  }
}
