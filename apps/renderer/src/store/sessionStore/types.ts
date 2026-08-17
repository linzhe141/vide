import type { ToolCall } from '@vide/ai'
import type { AgentMessage } from '@vide/ai'

/**
 * 后端通过 'session-loaded' 广播的完整 session 加载数据。
 * workflow.messages 为后端 AgentMessage（openai chat 格式），需经 loadSession 还原为 UI SessionMessage。
 * 与 apps/main/src/ipc/api/channels.ts 中的 LoadedSessionPayload 保持一致。
 */
export interface LoadedSessionPayload {
  sessionId: string
  autoApprove: boolean
  thinkingMode: boolean
  workspacePath: string | null
  activeBranch: string
  branches: { name: string; headWorkflowId: string | null; sourceWorkflowId: string | null }[]
  workflowNodes: {
    workflow: {
      id: string
      stopStatus: 'finished' | 'error' | 'aborted' | null
      messages: AgentMessage[]
    }
    children: string[]
    parent: string | null
  }[]
}


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

export interface AskUserQuestionSessionMessage {
  id: string
  role: 'ask-user-question'
  toolCallId: string
  title: string
  description?: string
  options: AskQuestionOption[]
  answer: {
    selected: string
    other?: string
  } | null
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

export type SessionArtifact = {
  id: string
  sessionId: string
  artifactWorkspaceName: string
  createdAt: number
  updatedAt: number
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
  autoApprove: boolean
  thinkingMode: boolean
  createdAt?: number
  updatedAt?: number
  sessionType: 'normal' | 'fork'
  origin: SessionOrigin | null
  workspacePath?: string | null
  activeBranch: string
  branches: SessionBranch[]
  workflowNodesMap: Record<string, WorkflowNode>
  runtime: SessionRuntime
  artifacts: SessionArtifact[]
}
