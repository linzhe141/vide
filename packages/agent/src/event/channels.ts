import type { AssistantChatMessage, ChatMessage, ToolCall } from '@vide/ai'
import type { AskUserQuestion, PlanStep } from '../types'

export type WorkflowEventCtx = {
  sessionId: string
  workflowId: string
  // branchName: string
  // parentWorkflowId: string | null
}

export const WorkflowEventChannels = {
  'workflow-start': null as unknown as { input: string },
  'workflow-finished': null,
  'workflow-aborted': null as unknown as {
    chunkData: { reasoning: string; text: string }
  },
  'workflow-wait-human-approve': null as unknown as {
    data: { index: number; toolCalls: ToolCall[] }
  },
  'workflow-error': null as unknown as { error: any },

  'workflow-llm-start': null as unknown as { messages: ChatMessage[] },

  'workflow-llm-reasoning-start': null,
  'workflow-llm-reasoning-delta': null as unknown as {
    chunk: { delta: string; content: string }
  },
  'workflow-llm-reasoning-end': null as unknown as { content: string },

  'workflow-llm-text-start': null,
  'workflow-llm-text-delta': null as unknown as {
    chunk: { delta: string; content: string }
  },
  'workflow-llm-text-end': null as unknown as { content: string },

  'workflow-llm-tool-calls-start': null,
  'workflow-llm-tool-call-name': null as unknown as {
    data: { id: string; name: string }
  },
  'workflow-llm-tool-call-arguments': null as unknown as {
    data: { id: string; arguments: string }
  },
  'workflow-llm-tool-calls-end': null as unknown as {
    toolCalls: ToolCall[]
  },

  'workflow-llm-end': null,
  'workflow-llm-result': null as unknown as {
    assistantChatMessage: AssistantChatMessage
  },
  'workflow-llm-error': null as unknown as { error: any },

  'workflow-tool-call-start': null as unknown as {
    toolCall: { id: string; toolName: string; args: any }
  },
  'workflow-tool-call-success': null as unknown as {
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
    toolCallResult: {
      id: string
      toolName: string
      error: any
    }
  },
  'workflow-tool-call-reject': null as unknown as {
    toolCallResult: { id: string; toolName: string; reject: any }
  },

  // plan events
  'planner-end-generate': null as unknown as {
    plannerId: string
    plans: PlanStep[]
  },
  'planner-execute-item-start': null as unknown as {
    plannerId: string
    plan: PlanStep
  },
  'planner-execute-item-success': null as unknown as {
    plannerId: string
    plan: PlanStep
  },
  'planner-execute-item-error': null as unknown as {
    plannerId: string
    plan: PlanStep
  },
  // ask user
  'ask-user': null as unknown as {
    workflowId: string
    question: AskUserQuestion
  },
  // artifact events
  'artifacts-created-workspace': null as unknown as {
    workspaceName: string
  },
} as const

// 简写
export type WorkflowEvent = {
  [K in keyof typeof WorkflowEventChannels]: (typeof WorkflowEventChannels)[K] extends null
    ? { eventName: K }
    : { eventName: K; data: (typeof WorkflowEventChannels)[K] }
}[keyof typeof WorkflowEventChannels]

// 完整 + ctx
export type WorkflowEventWithCtx = {
  [K in keyof typeof WorkflowEventChannels]: (typeof WorkflowEventChannels)[K] extends null
    ? { eventName: K; data: { ctx: WorkflowEventCtx } }
    : { eventName: K; data: { ctx: WorkflowEventCtx } & (typeof WorkflowEventChannels)[K] }
}[keyof typeof WorkflowEventChannels]

// IPC 使用
export type WorkflowIPCEvents = {
  [K in keyof typeof WorkflowEventChannels]: (
    data: (typeof WorkflowEventChannels)[K] extends null
      ? { ctx: WorkflowEventCtx }
      : { ctx: WorkflowEventCtx } & (typeof WorkflowEventChannels)[K]
  ) => void
}

export const workflowEventNames = Object.keys(
  WorkflowEventChannels
) as (keyof typeof WorkflowEventChannels)[]
