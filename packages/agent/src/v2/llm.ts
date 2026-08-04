import {
  type AgentMessage,
  type AI,
  type ChatMessage,
  type Tool,
  type ToolCall,
  createLLMClient,
  processLLMStream as processStream,
} from '@vide/ai'
import { AgentSystemPrompt } from '../prompt/system'
import { AbortError } from '../error'

type FnCallAI = (data: {
  ai: AI
  model: string
  messages: ChatMessage[]
  tools: Tool[]
  signal: AbortSignal
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
    onToolCallsEnd?: (toolCalls: ToolCall[]) => void
  }
}) => Promise<{ content: string; toolCalls: ToolCall[] }>

export const callAI: FnCallAI = async function ({ ai, model, messages, tools, signal, events }) {
  try {
    console.log('singal in processLLMStream', signal)
    let content = ''
    let toolCalls: ToolCall[] = []

    const stream = ai.chat.completions.create(
      {
        messages,
        model: model,
        stream: true,
        tools,
        reasoning_effort: 'medium',
      },
      { signal }
    )

    for await (const chunk of processStream(stream as any, events)) {
      if ('content' in chunk && chunk.content) {
        content = chunk.content
      }

      if ('tool_calls' in chunk && chunk.tool_calls) {
        toolCalls = chunk.tool_calls
      }
    }
    return { content, toolCalls }
  } catch (error: any) {
    console.error('Error in processLLMStream:', error)
    if (error.name === 'AbortError') {
      console.error('Stream was aborted by user')
      // 统一抛出 AbortError，方便上层捕获和处理
      throw new AbortError()
    }
    console.error('Error in processLLMStream:', error)
    // 其他错误继续往上抛
    throw error
  }
}

function isChatMessage(msg: AgentMessage): msg is ChatMessage {
  // 排除 ContextMessage 的特征
  return (
    msg.role === 'assistant' || msg.role === 'user' || msg.role === 'tool' || msg.role === 'system'
  )
}
export function buildAIMessages(messages: AgentMessage[]) {
  const defaultSystemMessage: AgentMessage = {
    role: 'system',
    content: AgentSystemPrompt,
  }
  return [defaultSystemMessage, ...messages.filter(isChatMessage)]
}

interface ModelConfig {
  name: string
  baseURL: string
  apiKey: string
}

export function createAIClient(model: ModelConfig) {
  return createLLMClient({ apiKey: model.apiKey, baseURL: model.baseURL })
}
