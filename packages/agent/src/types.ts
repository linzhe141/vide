import type { AgentMessage, ToolCall } from '@vide/ai'
import type { WorkflowState } from './workflow'

export type ToolApproval = {
  required?: boolean
  summary?: (args: any) => string
}

export type UserInputStepPayload = {
  input: string
}

export type CallLLMStepPayload = {
  messages: AgentMessage[]
}

export type CallToolsStepPayload = {
  toolCalls: ToolCall[]
}

export type WaitHumanApprovePayload = {
  index: number
  toolCalls: ToolCall[]
}

export type CallToolStepPayload = {
  index: number
  toolCalls: ToolCall[]
  //
  hasApproval: boolean
}

export type FinishedStepPayload = {
  content: string
}

export type StepPayload =
  | UserInputStepPayload
  | CallLLMStepPayload
  | CallToolsStepPayload
  | WaitHumanApprovePayload
  | CallToolStepPayload
  | FinishedStepPayload

export type StepResult = {
  state: WorkflowState
  payload: StepPayload
}

// toolcall
export type PlanStep = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  description: string
}

export type AskUserQuestionOption = {
  label: string
  value: string
}

export type AskUserQuestion = {
  title: string
  description?: string
  options: AskUserQuestionOption[]
}
