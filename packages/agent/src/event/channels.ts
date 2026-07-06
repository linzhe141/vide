import type { AssistantChatMessage, ChatMessage, ToolCall } from '@vide/ai'
import type { AskUserQuestion, PlanStep } from '../types'

const AgentLifecycleEventChannels = {
  'agent-create-session1': null as unknown as {
    sessionId: string
    activeBranch: string
    sessionType: 'normal' | 'fork'
    originSessionId: string | null
    originWorkflowId: string | null
    workspacePath: string | null
    autoApprove: boolean
  },
  'agent-session-finished1': null as unknown as {
    sessionId: string
    userInput: string
  },
  'agent-session-forked1': null as unknown as {
    sourceSessionId: string
    forkedSessionId: string
    sourceWorkflowId: string | null
  },
  'agent-workflow-regenerated1': null as unknown as {
    sessionId: string
    branchName: string
    sourceWorkflowId: string | null
    input?: string
  },
}
export type AgentLifecycleEventKey = keyof typeof AgentLifecycleEventChannels
export type AgentLifecycleEvents = {
  [K in AgentLifecycleEventKey]: (data: (typeof AgentLifecycleEventChannels)[K]) => void
}

export type WorkflowEventCtx = {
  sessionId: string
  workflowId: string
  branchName: string
  parentWorkflowId: string | null
}
export const WorkflowEventChannels = {
  'workflow-start': null as unknown as { input: string; ctx: WorkflowEventCtx },
  'workflow-finished': null as unknown as { ctx: WorkflowEventCtx },
  'workflow-aborted': null as unknown as {
    ctx: WorkflowEventCtx
    chunkData: { reasoning: string; text: string }
  },
  'workflow-wait-human-approve': null as unknown as {
    ctx: WorkflowEventCtx
    data: { index: number; toolCalls: ToolCall[] }
  },
  'workflow-error': null as unknown as { ctx: WorkflowEventCtx; error: any },

  'workflow-llm-start': null as unknown as { ctx: WorkflowEventCtx; messages: ChatMessage[] },

  'workflow-llm-reasoning-start': null as unknown as { ctx: WorkflowEventCtx },
  'workflow-llm-reasoning-delta': null as unknown as {
    ctx: WorkflowEventCtx
    chunk: { delta: string; content: string }
  },
  'workflow-llm-reasoning-end': null as unknown as { ctx: WorkflowEventCtx; content: string },

  'workflow-llm-text-start': null as unknown as { ctx: WorkflowEventCtx },
  'workflow-llm-text-delta': null as unknown as {
    ctx: WorkflowEventCtx
    chunk: { delta: string; content: string }
  },
  'workflow-llm-text-end': null as unknown as { ctx: WorkflowEventCtx; content: string },

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
    toolCallResult: {
      id: string
      toolName: string
      result: any
      startedAt: number
      finishedAt: number
      durationMs: number
    }
  },
  'workflow-tool-call-error': null as unknown as {
    ctx: WorkflowEventCtx
    toolCallResult: {
      id: string
      toolName: string
      error: any
    }
  },
  'workflow-tool-call-reject': null as unknown as {
    ctx: WorkflowEventCtx
    toolCallResult: { id: string; toolName: string; reject: any }
  },

  // plan events
  'planner-end-generate': null as unknown as {
    ctx: WorkflowEventCtx
    plannerId: string
    plans: PlanStep[]
  },
  'planner-execute-item-start': null as unknown as {
    ctx: WorkflowEventCtx
    plannerId: string
    plan: PlanStep
  },
  'planner-execute-item-success': null as unknown as {
    ctx: WorkflowEventCtx
    plannerId: string
    plan: PlanStep
  },
  'planner-execute-item-error': null as unknown as {
    ctx: WorkflowEventCtx
    plannerId: string
    plan: PlanStep
  },
  // ask user
  'ask-user': null as unknown as {
    ctx: WorkflowEventCtx
    workflowId: string
    question: AskUserQuestion
  },
  // artifact events
  'artifacts-created-workspace': null as unknown as {
    ctx: WorkflowEventCtx
    workspaceName: string
  },
} as const
export type WorkflowEventKey = keyof typeof WorkflowEventChannels
export type WorkflowEvents = {
  [K in WorkflowEventKey]: (data: (typeof WorkflowEventChannels)[K]) => void
}
export type Events = AgentLifecycleEvents | WorkflowEvents

export const agentEventNames = Object.keys(AgentLifecycleEventChannels) as AgentLifecycleEventKey[]
export const workflowEventNames = Object.keys(WorkflowEventChannels) as WorkflowEventKey[]
