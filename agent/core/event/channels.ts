import type { ChatMessage, FinishReason, ToolCall } from '../types'

export type AgentLifecycleEvents = {
  'agent:init': () => void
  'agent:ready': () => void
}

export type SessionEvents = {
  'session:created': (data: { sessionId: string }) => void
  'session:system-prompt:set': (data: {
    sessionId: string
    prompt: string
  }) => void
  'session:user-input': (data: { sessionId: string; input: string }) => void
  'session:add-assistant-tool-calls-message': (data: {
    sessionId: string
    input: string
  }) => void
}

export type WorkflowEvents = {
  'workflow:start': (data: { sessionId: string; input: string }) => void
  'workflow:finished': (data: { sessionId: string }) => void
}

export type LLMEvents = {
  'llm:request:start': (data: {
    sessionId: string
    messages: ChatMessage[]
  }) => void
  'llm:request:delta': (data: { delta: string; content: string }) => void
  'llm:request:tool-calls': (data: { toolCalls: ToolCall[] }) => void
  'llm:request:end': (data: { finishReason: FinishReason }) => void
  'llm:request:error': (data: { error: Error }) => void
}

export type ToolEvents = {
  'tool:call:start': (data: {
    sessionId: string
    toolName: string
    args: any
  }) => void
  'tool:call:success': (data: {
    sessionId: string
    toolName: string
    result: any
  }) => void
  'tool:call:error': (data: {
    sessionId: string
    toolName: string
    error: Error
  }) => void
}

export type AgentEvents = AgentLifecycleEvents &
  SessionEvents &
  WorkflowEvents &
  LLMEvents &
  ToolEvents
