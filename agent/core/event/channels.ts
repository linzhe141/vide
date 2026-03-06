import type { PlanStep } from '../agentSession'
import type { AssistantChatMessage, CallToolStepPayload, ChatMessage, ToolCall } from '../types'

const AgentLifecycleEventChannels = {
  'agent-create-session': null as unknown as { sessionId: string },
  'agent-session-start-analyze-input': null as unknown as { sessionId: string; userInput: string },
  'agent-session-end-analyze-input': null as unknown as {
    sessionId: string
    userInput: string
    mode: 'plan' | 'normal'
  },
  'agent-session-finished': null as unknown as {
    sessionId: string
    userInput: string
  },
}
export type AgentLifecycleEventKey = keyof typeof AgentLifecycleEventChannels
export type AgentLifecycleEvents = {
  [K in AgentLifecycleEventKey]: (data: (typeof AgentLifecycleEventChannels)[K]) => void
}

const PlannerEventChannels = {
  'planner-start-generate': null as unknown as { sessionId: string; plannerId: string },
  'planner-end-generate': null as unknown as {
    sessionId: string
    plannerId: string
    plans: PlanStep[]
  },
  'planner-execute-item-start': null as unknown as {
    sessionId: string
    plannerId: string
    plan: PlanStep
  },
  'planner-execute-item-success': null as unknown as {
    sessionId: string
    plannerId: string
    plan: PlanStep
  },
  'planner-execute-item-error': null as unknown as {
    sessionId: string
    plannerId: string
    plan: PlanStep
  },
}
export type PlannerEventKey = keyof typeof PlannerEventChannels
export type PlannerEvents = {
  [K in PlannerEventKey]: (data: (typeof PlannerEventChannels)[K]) => void
}

export type WorkflowEventCtx = { sessionId: string; workflowId: string; planId?: string }
const WorkflowEventChannels = {
  'workflow-start': null as unknown as { input: string; ctx: WorkflowEventCtx },
  'workflow-finished': null as unknown as { ctx: WorkflowEventCtx },
  'workflow-wait-human-approve': null as unknown as {
    payload: CallToolStepPayload
    ctx: WorkflowEventCtx
  },
  'workflow-error': null as unknown as { ctx: WorkflowEventCtx; error: any },

  'workflow-llm-start': null as unknown as { ctx: WorkflowEventCtx; messages: ChatMessage[] },

  'workflow-llm-reasoning-start': null as unknown as { ctx: WorkflowEventCtx },
  'workflow-llm-reasoning-delta': null as unknown as {
    ctx: WorkflowEventCtx
    chunk: { delta: string; content: string }
  },
  'workflow-llm-reasoning-end': null as unknown as { ctx: WorkflowEventCtx },

  'workflow-llm-text-start': null as unknown as { ctx: WorkflowEventCtx },
  'workflow-llm-text-delta': null as unknown as {
    ctx: WorkflowEventCtx
    chunk: { delta: string; content: string }
  },
  'workflow-llm-text-end': null as unknown as { ctx: WorkflowEventCtx },

  'workflow-llm-tool-calls-start': null as unknown as { ctx: WorkflowEventCtx },
  'workflow-llm-tool-call-name': null as unknown as {
    ctx: WorkflowEventCtx
    data: { id: string; name: string }
  },
  'workflow-llm-tool-call-arguments': null as unknown as {
    ctx: WorkflowEventCtx
    data: { id: string; arguments: string }
  },
  'workflow-llm-tool-calls-end': null as unknown as {
    ctx: WorkflowEventCtx
    toolCalls: ToolCall[]
  },

  'workflow-llm-end': null as unknown as { ctx: WorkflowEventCtx },
  'workflow-llm-result': null as unknown as {
    ctx: WorkflowEventCtx
    assistantChatMessage: AssistantChatMessage
  },
  'workflow-llm-error': null as unknown as { ctx: WorkflowEventCtx; error: any },

  'workflow-tool-call-start': null as unknown as {
    ctx: WorkflowEventCtx
    toolCall: { id: string; toolName: string; args: any }
  },
  'workflow-tool-call-success': null as unknown as {
    ctx: WorkflowEventCtx
    toolCallResult: { id: string; toolName: string; result: any }
  },
  'workflow-tool-call-error': null as unknown as {
    ctx: WorkflowEventCtx
    toolCallResult: { id: string; toolName: string; error: any }
  },
  'workflow-tool-call-reject': null as unknown as {
    ctx: WorkflowEventCtx
    toolCallResult: { id: string; toolName: string; reject: any }
  },
} as const
export type WorkflowEventKey = keyof typeof WorkflowEventChannels
export type WorkflowEvents = {
  [K in WorkflowEventKey]: (data: (typeof WorkflowEventChannels)[K]) => void
}
export type Events = AgentLifecycleEvents | WorkflowEvents | PlannerEvents

export const agentEventNames = Object.keys(AgentLifecycleEventChannels) as AgentLifecycleEventKey[]
export const plannerEventNames = Object.keys(PlannerEventChannels) as PlannerEventKey[]
export const workflowEventNames = Object.keys(WorkflowEventChannels) as WorkflowEventKey[]
