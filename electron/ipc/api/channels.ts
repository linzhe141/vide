import type { Settings } from '@/electron/store/settingsStore'
import type { LLMConfig } from '@/types'
import type {
  AgentLifecycleEvents,
  PlannerEvents,
  WorkflowEvents,
} from '@/agent/core/event/channels'
import type { threadWorkflowBlockMessages } from '@/db/schema'
import type { PlanStep } from '@/agent/core/tools/planner'

export type FileNode = {
  name: string
  type: 'file' | 'folder'
  path: string // 绝对路径
  content?: string
  children?: FileNode[]
}

export type ThreadRowDto = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}
export type BlockData = {
  id: string
  userInput: string
  parentBlockId?: string | null
  askUserSubmitValue?: string[]
  messages: (typeof threadWorkflowBlockMessages.$inferSelect)[]
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
    blockData: BlockData[]
    artifacts: {
      id: string
      threadId: string
      artifactWorkspaceName: string
      createdAt: number
      updatedAt: number
    }[]
  }>
  'agent-session-send': (data: { input: string; branchName?: string }) => void
  'agent-session-fork': (data: { targetBlockId: string | null; branchName: string }) => void
  'agent-human-approved': () => void
  'agent-human-rejected': () => void
  'agent-workflow-abort': () => void

  'ask-user-question-submit': (data: { submitValue: string[]; workflowId: string }) => void

  // thread message
  'get-threads-list': () => Promise<ThreadRowDto[]>

  // submit llm settings
  'submit-llm-seetings': (data: LLMConfig) => void
  'verify-llm-settings-connection': (
    data: LLMConfig
  ) => Promise<{ success: true } | { success: false; error: any }>
  // only dev
  'dev-delete-database-rows': () => void

  'get-thread-artifacts': (data: { sessionId: string }) => Promise<
    {
      id: string
      threadId: string
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
