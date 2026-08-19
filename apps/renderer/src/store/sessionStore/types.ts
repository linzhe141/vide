import type { ToolCall } from '@vide/ai'
import type { SessionSource } from '@vide/config'

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
  streaming: boolean
}

export interface ToolCallSessionMessage {
  id: string
  role: 'tool-call'
  toolCalls: ToolCallState[]
}

export interface ToolCallResult {
  status: 'success' | 'error'
  result?: any
  error?: any
  startedAt?: number
  finishedAt?: number
  durationMs?: number
}

export interface ToolCallState {
  toolCall: ToolCall
  result?: ToolCallResult
}

export type AskQuestionOption = {
  label: string
  value: string
}

export type AskQuestionAnswer = {
  selected: string
  other?: string
}

export type AskUserQuestionItem = {
  id: string
  title: string
  description?: string
  options: AskQuestionOption[]
  answer: AskQuestionAnswer | null
}

export interface AskUserQuestionSessionMessage {
  id: string
  role: 'ask-user-question'
  toolCallId: string
  questions: AskUserQuestionItem[]
}

export interface ErrorSessionMessage {
  id: string
  role: 'error'
  error: any
}

export type WorkflowLogEvent = {
  id: string
  type: string
  createdAt: number
  payload?: unknown
}

// sub agent messages
export type WorkflowSessionMessage = {
  role: 'workflow'
} & Workflow

export type SessionMessage =
  | UserInputSessionMessage
  | AssistantReasonSessionMessage
  | AssistantTextSessionMessage
  | ToolCallSessionMessage
  | AskUserQuestionSessionMessage
  | ErrorSessionMessage
  | WorkflowSessionMessage

export type Workflow = {
  id: string
  input: string
  inputSource: SessionSource
  feedback: 'like' | 'dislike' | null
  events?: WorkflowLogEvent[]
  messages: SessionMessage[]
  runtime: {
    status: 'running' | 'finished' | 'error' | 'aborted' | 'interrupted' // 这里的 interrupted 是可恢复的中断， 也就是 human approve
  }
  nextSubWorkflow?: Workflow
  // 指向真正运行的子工作流
  subWorkflow?: Workflow
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

export type Session = {
  sessionId: string
  sessionSource: SessionSource
  autoApprove: boolean
  thinkingMode: boolean
  workspacePath?: string | null
  activeBranch: string
  branches: SessionBranch[]
  workflowNodesMap: Record<string, WorkflowNode>
  runtime: SessionRuntime
}
