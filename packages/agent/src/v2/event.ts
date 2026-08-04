import type { AssistantChatMessage, ToolCall } from '@vide/ai'

export interface WorkflowStartEvent {
  type: 'workflow.start'
  input: string
}

export interface WorkflowStartEvent {
  type: 'workflow.start'
  input: string
}

export interface WorkflowCompletedEvent {
  type: 'workflow.completed'
  result: string
}

export interface WorkflowLLMStartEvent {
  type: 'workflow.llm.start'
}

export interface WorkflowLLMReasonStartEvent {
  type: 'workflow.llm.reason.start'
}

export interface WorkflowLLMReasonDeltaEvent {
  type: 'workflow.llm.reason.delta'
  chunk: { delta: string }
}

export interface WorkflowLLMReasonEndEvent {
  type: 'workflow.llm.reason.end'
  content: string
}

export interface WorkflowLLMTextStartEvent {
  type: 'workflow.llm.text.start'
}

export interface WorkflowLLMTextDeltaEvent {
  type: 'workflow.llm.text.delta'
  chunk: { delta: string }
}

export interface WorkflowLLMTextEndEvent {
  type: 'workflow.llm.text.end'
  content: string
}

export interface WorkflowLLMToolCallEvent {
  type: 'workflow.llm.tool.call'
  toolCall: ToolCall[]
}

export interface WorkflowLLMEndEvent {
  type: 'workflow.llm.end'
}

export interface WorkflowLLMResultEvent {
  type: 'workflow.llm.result'
  assistantChatMessage: AssistantChatMessage
}

export interface WorkflowLLMErrorEvent {
  type: 'workflow.llm.error'
  error: any
}

export interface WorkflowToolCallStartEvent {
  type: 'workflow.tool.call.start'
  toolCall: { id: string; toolName: string; args: any }
}

export interface WorkflowToolCallSuccessEvent {
  type: 'workflow.tool.call.success'
  toolCallResult: {
    id: string
    toolName: string
    result: any
    startedAt: number
    finishedAt: number
    durationMs: number
  }
}

export interface WorkflowToolCallErrorEvent {
  type: 'workflow.tool.call.error'
  toolCallResult: {
    id: string
    toolName: string
    error: any
  }
}

export type WorkflowEvent =
  | WorkflowStartEvent
  | WorkflowCompletedEvent
  | WorkflowLLMStartEvent
  | WorkflowLLMReasonStartEvent
  | WorkflowLLMReasonDeltaEvent
  | WorkflowLLMReasonEndEvent
  | WorkflowLLMTextStartEvent
  | WorkflowLLMTextDeltaEvent
  | WorkflowLLMTextEndEvent
  | WorkflowLLMToolCallEvent
  | WorkflowLLMEndEvent
  | WorkflowLLMResultEvent
  | WorkflowLLMErrorEvent
  | WorkflowToolCallStartEvent
  | WorkflowToolCallSuccessEvent
  | WorkflowToolCallErrorEvent
