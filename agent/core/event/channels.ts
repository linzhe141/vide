import type { ChatMessage, FinishReason, ToolCall } from '../types'

export type AgentLifecycleEvents = {
  'agent:init': () => void
  'agent:ready': () => void
}

export type TheadEvents = {
  'thead:created': (data: { theadId: string }) => void
  'thead:system-prompt:set': (data: { theadId: string; prompt: string }) => void
  'thead:user-input': (data: { theadId: string; input: string }) => void
  'thead:add-assistant-tool-calls-message': (data: { theadId: string; input: string }) => void
}

export type WorkflowEvents = {
  'workflow:start': (data: { theadId: string; input: string }) => void
  'workflow:finished': (data: { theadId: string }) => void
  'workflow:wait-human-approve': (data: any) => void
}

export type LLMEvents = {
  'llm:request:start': (data: { theadId: string; messages: ChatMessage[] }) => void
  'llm:request:delta': (data: { delta: string; content: string }) => void
  'llm:request:tool-calls': (data: { toolCalls: ToolCall[] }) => void
  'llm:request:end': (data: { finishReason: FinishReason }) => void
  'llm:request:error': (data: { error: Error }) => void
}

export type ToolEvents = {
  'tool:call:start': (data: { theadId: string; toolName: string; args: any }) => void
  'tool:call:success': (data: { theadId: string; toolName: string; result: any }) => void
  'tool:call:error': (data: { theadId: string; toolName: string; error: Error }) => void
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

export type Events = AgentLifecycleEvents | TheadEvents | WorkflowEvents | LLMEvents | ToolEvents

export type AgentEvents = UnionToIntersection<Events>
