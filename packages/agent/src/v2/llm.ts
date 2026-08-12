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

type FnCallAI = (data: {
  ai: AI
  model: string
  messages: ChatMessage[]
  tools: Tool[]
  signal: AbortSignal
  thinkingMode: boolean
  events: {
    onReasoningStart?: () => void
    onReasoningDelta?: (chunk: { delta: string; content: string }) => void
    onReasoningEnd?: (content: string) => void

    onTextStart?: () => void
    onTextDelta?: (chunk: { delta: string; content: string }) => void
    onTextEnd?: (content: string) => void

    onToolCallsStart?: () => void
    onToolCallsEnd?: (toolCalls: ToolCall[]) => void
  }
}) => Promise<{ content: string; toolCalls: ToolCall[] }>

export const callAI: FnCallAI = async function ({
  ai,
  model,
  messages,
  tools,
  signal,
  events,
  thinkingMode,
}) {
  let content = ''
  let toolCalls: ToolCall[] = []
  // @ts-expect-error ignore 类型错误
  const stream = ai.chat.completions.create(
    {
      messages,
      model: model,
      stream: true,
      tools,
      reasoning_effort: thinkingMode ? 'medium' : 'none',
      thinking: { type: thinkingMode ? 'enabled' : 'disabled' },
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
  signal.throwIfAborted()
  return { content, toolCalls }
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

export interface ModelConfig {
  name: string
  baseURL: string
  apiKey: string
}

export function createAIClient(model: ModelConfig) {
  return createLLMClient({ apiKey: model.apiKey, baseURL: model.baseURL })
}
