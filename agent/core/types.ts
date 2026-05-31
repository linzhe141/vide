import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources/chat/completions.mjs'
import type { WorkflowState } from './workflow'

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

export type FinishReason = 'stop' | 'tool_calls'

export type ToolCall = {
  function: { arguments: string; name: string }
  id: string
  type: 'function'
}

export type UserInputStepPayload = {
  input: string
}

export type CallLLMStepPayload = {
  messages: ChatMessage[]
}

export type CallToolsStepPayload = {
  toolCalls: ToolCall[]
}

export type WaitHumanApprovePayload = {
  index: number
  toolCalls: ToolCall[]
}

export type CallToolStepPayload = {
  index: number
  toolCalls: ToolCall[]
  // 
  hasApproval: boolean
}

export type FinishedStepPayload = {
  content: string
}

export type StepPayload =
  | UserInputStepPayload
  | CallLLMStepPayload
  | CallToolsStepPayload
  | WaitHumanApprovePayload
  | CallToolStepPayload
  | FinishedStepPayload

export type StepResult = {
  state: WorkflowState
  payload: StepPayload
}

export type StreamContentChunk = {
  content: string
  delta: string
  finishReason?: FinishReason
}

export type StreamToolCallsChunk = {
  tool_calls: ToolCall[]
  finishReason: 'tool_calls'
}

export type FnProcessLLMStream = (data: {
  messages: ChatMessage[]
  tools: Tool[]
  signal: AbortSignal
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
}) => AsyncGenerator<StreamContentChunk | StreamToolCallsChunk>

export interface ToolResult {
  reason: 'stop' | 'call-llm'
  result: any
}
