import type {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
  ChatCompletionTool,
} from 'openai/resources/chat/completions.mjs'

export type ChatMessage = ChatCompletionMessageParam

export type Tool = ChatCompletionTool & {
  name: string
  executor: (args: any) => Promise<any>
}

export type FinishReason = ChatCompletionChunk.Choice['finish_reason']

export type ToolCall = {
  function: { arguments: string; name: string }
  id: string
  type: 'function'
}

export type AgentState =
  | 'user-input'
  | 'call-llm'
  | 'call-tool'
  | 'human-approve'
  | 'finished'

export type UserInputStepPayload = {
  input: string
}

export type CallLLMStepPayload = {
  messages: ChatMessage[]
}

export type CallToolStepPayload = {
  toolCall: ToolCall
}

export type FinishedStepPayload = {
  content: string
}

export type StepPayload =
  | UserInputStepPayload
  | CallLLMStepPayload
  | CallToolStepPayload
  | FinishedStepPayload

export type StepResult = {
  state: AgentState
  payload: StepPayload
}

export type StreamContentChunk = {
  content: string
  delta: string
  finishReason?: 'stop' | 'tool_calls'
}

export type StreamToolCallsChunk = {
  tool_calls: ToolCall[]
  finishReason: 'tool_calls'
}

export type FnProcessLLMStream = (data: {
  messages: ChatMessage[]
  tools: Tool[]
}) => AsyncGenerator<StreamContentChunk | StreamToolCallsChunk>
