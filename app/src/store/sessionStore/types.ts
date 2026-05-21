import type { ToolCall } from '@/agent/core/types'

export interface UserInputSessionMessage {
  id: string
  role: 'user'
  content: string
}

export interface AssistantReasonSessionMessage {
  id: string
  role: 'assistant-reason'
  content: string
  reasoning: boolean
}

export interface AssistantTextSessionMessage {
  id: string
  role: 'assistant-text'
  content: string
}

export interface ToolCallSessionMessage {
  id: string
  role: 'tool-call'
  toolCalls: ToolCall[]
}

export interface ToolResultSessionMessage {
  id: string
  role: 'tool-result'
  toolCallId: string
  status: 'success' | 'error'
  result?: any
  error?: any
  startedAt?: number
  finishedAt?: number
  durationMs?: number
}

export interface AskUserSessionMessage {
  id: string
  role: 'ask-user'
  completed: boolean
  submitValue: string[]
  title: string
  description: string
  type: 'single' | 'multiple'
  options: { label: string; value: string; description: string }[]
}

export interface ErrorSessionMessage {
  id: string
  role: 'error'
  error: any
}

export type SessionMessage =
  | UserInputSessionMessage
  | AssistantReasonSessionMessage
  | AssistantTextSessionMessage
  | ToolCallSessionMessage
  | ToolResultSessionMessage
  | AskUserSessionMessage
  | ErrorSessionMessage

export type Workflow = {
  id: string
  input: string
  messages: SessionMessage[]
  runtime: {
    status: 'running' | 'finished' | 'error'
    waitingHuman: boolean
  }
}

export type SessionRuntime = {
  running: boolean
}

export type PlanStep = {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export type WorkflowNode = {
  workflow: Workflow
  children: string[]
  parent: string | null
}

export type SessionBranch = {
  name: string
  headWorkflowId: string | null
  sourceWorkflowId: string | null
}

export type SessionOrigin = {
  sessionId: string
  workflowId: string | null
}

export type Session = {
  sessionId: string
  title?: string
  createdAt?: number
  updatedAt?: number
  sessionType: 'normal' | 'fork'
  origin: SessionOrigin | null
  activeBranch: string
  branches: SessionBranch[]
  workflowNodesMap: Record<string, WorkflowNode>
  runtime: SessionRuntime
  planner: { id: string; plan: PlanStep[] }[]
  artifacts: {
    id: string
    sessionId: string
    artifactWorkspaceName: string
    createdAt: number
    updatedAt: number
  }[]
}
