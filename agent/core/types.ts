import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions.mjs'

export type ChatMessage = ChatCompletionMessageParam

export type Tool = ChatCompletionTool & {
  name: string
  executor: (args: any) => Promise<any>
}

export type FinishReason = 'stop' | 'tool_calls' | 'error'

export type ToolCall = {
  function: { arguments: string; name: string }
  id: string
  type: 'function'
}

export type WorkflowState = 'user-input' | 'call-llm' | 'call-tools' | 'finished'

export type UserInputStepPayload = {
  input: string
}

export type CallLLMStepPayload = {
  messages: ChatMessage[]
}

export type CallToolsStepPayload = {
  toolCalls: ToolCall[]
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
  | CallToolsStepPayload
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
}) => AsyncGenerator<StreamContentChunk | StreamToolCallsChunk>
