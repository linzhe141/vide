import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources/chat/completions.mjs'

export type SystemChatMessage = ChatCompletionSystemMessageParam
export type UserChatMessage = ChatCompletionUserMessageParam
export type AssistantChatMessage = ChatCompletionAssistantMessageParam
export type ToolChatMessage = ChatCompletionToolMessageParam

export type ChatMessage =
  | SystemChatMessage
  | UserChatMessage
  | AssistantChatMessage
  | ToolChatMessage

export type ToolApproval = {
  required?: boolean
  summary?: (args: any) => string
}

export type Tool = ChatCompletionTool & {
  name: string
  approval?: ToolApproval
  executor: (args: any) => Promise<ToolResult>
}

export interface ToolResult {
  reason: 'stop' | 'call-llm'
  result: any
}

export type FinishReason = 'stop' | 'tool_calls'

export type ToolCall = {
  function: { arguments: string; name: string }
  id: string
  type: 'function'
  status: 'auto-approved' | 'waiting-human' | 'human-approved' | 'human-rejected'
}

