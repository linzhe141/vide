import type { PlanStep } from '../agentSession'
import type { AssistantChatMessage, CallToolStepPayload, ChatMessage, ToolCall } from '../types'

export type AgentLifecycleEvents = {
  'agent-create-session': (data: { sessionId: string }) => void
  'agent-session-start-analyze-input': (data: { sessionId: string; userInput: string }) => void
  'agent-session-end-analyze-input': (data: {
    sessionId: string
    userInput: string
    mode: 'plan' | 'normal'
  }) => void
}

export type PlannerEvents = {
  'planner-start-generate': (data: { sessionId: string; plannerId: string }) => void
  'planner-end-generate': (data: {
    sessionId: string
    plannerId: string
    plans: PlanStep[]
  }) => void
  'planner-execute-item-start': (data: {
    sessionId: string
    plannerId: string
    plan: PlanStep
  }) => void
  'planner-execute-item-success': (data: {
    sessionId: string
    plannerId: string
    plan: PlanStep
  }) => void

  'planner-execute-item-error': (data: {
    sessionId: string
    plannerId: string
    plan: PlanStep
  }) => void
}

export type WorkflowEventCtx = { sessionId: string; workflowId: string; planId?: string }
export type WorkflowEvents = {
  'workflow-start': (data: { input: string; ctx: WorkflowEventCtx }) => void
  'workflow-finished': (data: { ctx: WorkflowEventCtx }) => void
  'workflow-aborted': (data: { ctx: WorkflowEventCtx }) => void
  'workflow-wait-human-approve': (data: {
    payload: CallToolStepPayload
    ctx: WorkflowEventCtx
  }) => void
  'workflow-error': (data: { ctx: WorkflowEventCtx; error: any }) => void

  // call llm
  'workflow-llm-start': (data: { ctx: WorkflowEventCtx; messages: ChatMessage[] }) => void
  'workflow-llm-text-start': (data: { ctx: WorkflowEventCtx }) => void
  'workflow-llm-text-delta': (data: {
    ctx: WorkflowEventCtx
    chunk: { delta: string; content: string }
  }) => void
  'workflow-llm-text-end': (data: { ctx: WorkflowEventCtx }) => void
  'workflow-llm-tool-calls': (data: { ctx: WorkflowEventCtx; toolCalls: ToolCall[] }) => void
  'workflow-llm-end': (data: { ctx: WorkflowEventCtx }) => void
  'workflow-llm-result': (data: {
    ctx: WorkflowEventCtx
    assistantChatMessage: AssistantChatMessage
  }) => void
  'workflow-llm-error': (data: { ctx: WorkflowEventCtx; error: any }) => void

  // calltool
  'workflow-tool-call-start': (data: {
    ctx: WorkflowEventCtx
    toolCall: { id: string; toolName: string; args: any }
  }) => void
  'workflow-tool-call-success': (data: {
    ctx: WorkflowEventCtx
    toolCallResult: { id: string; toolName: string; result: any }
  }) => void
  'workflow-tool-call-error': (data: {
    ctx: WorkflowEventCtx
    toolCallResult: { id: string; toolName: string; error: any }
  }) => void
  'workflow-tool-call-reject': (data: {
    ctx: WorkflowEventCtx
    toolCallResult: { id: string; toolName: string; reject: any }
  }) => void
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

export type Events = AgentLifecycleEvents | WorkflowEvents | PlannerEvents

export type AgentEvents = UnionToIntersection<Events>
