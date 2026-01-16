import type { ChatMessage, FinishReason, ToolCall } from '../types'

export type AgentLifecycleEvents = {
  'agent-ready': () => void
}

// TODO
export type TheadEvents = {
  'thread-created': (data: { threadId: string }) => void
  'thread-message-added': (data: { threadId: string; message: ChatMessage }) => void
  'thread-message-updated': (data: { threadId: string; message: ChatMessage }) => void
  'thread-message-deleted': (data: { threadId: string }) => void
}

export type WorkflowEvents = {
  'workflow-start': (data: { threadId: string; input: string }) => void
  'workflow-finished': (data: { threadId: string }) => void
  'workflow-aborted': (data: { threadId: string }) => void
  'workflow-wait-human-approve': (data: any) => void
}

export type LLMEvents = {
  'llm-start': (data: { messages: ChatMessage[] }) => void
  'llm-delta': (data: { delta: string; content: string }) => void
  'llm-tool-calls': (data: { toolCalls: ToolCall[] }) => void
  'llm-end': (data: { finishReason: FinishReason }) => void
  'llm-result': (data: ChatMessage) => void
  'llm-error': (data: { error: any }) => void
  'llm-aborted': () => void
}

export type ToolEvents = {
  'tool-call-start': (data: { id: string; toolName: string; args: any }) => void
  'tool-call-success': (data: { id: string; toolName: string; result: any }) => void
  'tool-call-error': (data: { id: string; toolName: string; error: any }) => void
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

export type Events = AgentLifecycleEvents | TheadEvents | WorkflowEvents | LLMEvents | ToolEvents

export type AgentEvents = UnionToIntersection<Events>
