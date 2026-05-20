import type { Settings } from '@/electron/store/settingsStore'
import type { LLMConfig } from '@/types'
import type {
  AgentLifecycleEvents,
  PlannerEvents,
  WorkflowEvents,
} from '@/agent/core/event/channels'
import type { sessionWorkflowMessages } from '@/db/schema'
import type { PlanStep } from '@/agent/core/tools/planner'

export type FileNode = {
  name: string
  type: 'file' | 'folder'
  path: string // 绝对路径
  content?: string
  children?: FileNode[]
}

export type SessionRowDto = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}
export type WorkflowData = {
  id: string
  userInput: string
  parentWorkflowId?: string | null
  askUserSubmitValue?: string[]
  messages: (typeof sessionWorkflowMessages.$inferSelect)[]
}

export interface RenderChannel {
  // electron store
  'get-settings-store': () => Settings
  'dispatch-settings-store': (data: Record<string, unknown>) => void

  // window
  'maxmize-window': () => void
  'minmize-window': () => void
  'close-window': () => void

  // agent
  'agent-create-session': () => Promise<string>
  'agent-resume-session': (data: { sessionId: string }) => Promise<{
    activeBranch: string
    branches: { name: string; headWorkflowId: string | null }[]
    planner: { id: string; plan: PlanStep[] }[]
    workflowData: WorkflowData[]
    artifacts: {
      id: string
      sessionId: string
      artifactWorkspaceName: string
      createdAt: number
      updatedAt: number
    }[]
  }>
  'agent-session-send': (data: { input: string; branchName?: string }) => void
  'agent-session-fork': (data: { targetWorkflowId: string | null; branchName: string }) => void
  'agent-human-approved': () => void
  'agent-human-rejected': () => void
  'agent-workflow-abort': () => void

  'ask-user-question-submit': (data: { submitValue: string[]; workflowId: string }) => void

  // session message
  'get-sessions-list': () => Promise<SessionRowDto[]>

  // submit llm settings
  'submit-llm-seetings': (data: LLMConfig) => void
  'verify-llm-settings-connection': (
    data: LLMConfig
  ) => Promise<{ success: true } | { success: false; error: any }>
  // only dev
  'dev-delete-database-rows': () => void

  'get-session-artifacts': (data: { sessionId: string }) => Promise<
    {
      id: string
      sessionId: string
      artifactWorkspaceName: string
      createdAt: number
      file: FileNode
      updatedAt: number
    }[]
  >
}

export type MainChannel = {
  // example
  sendChunk: (chunk: string) => void
  foo: (data: Record<'foo', 'bar'>) => void
  ping: () => void

  // window
  'changed-window-size': (isMaximized: boolean) => void
} & AgentLifecycleEvents &
  PlannerEvents &
  WorkflowEvents
