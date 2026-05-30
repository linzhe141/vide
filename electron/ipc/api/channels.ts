import type { Settings } from '@/electron/store/settingsStore'
import type { GenerateImageConfig, LLMConfig } from '@/types'
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
  type: 'normal' | 'fork'
  originSessionId: string | null
  originWorkflowId: string | null
  workspacePath: string | null
  createdAt: number
  updatedAt: number
}
export type WorkflowData = {
  id: string
  userInput: string
  parentWorkflowId: string | null
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
  'agent-create-session': (data?: { workspacePath?: string | null }) => Promise<string>
  'agent-resume-session': (data: { sessionId: string }) => Promise<{
    sessionType: 'normal' | 'fork'
    origin: { sessionId: string; workflowId: string | null } | null
    activeBranch: string
    branches: { name: string; headWorkflowId: string | null; sourceWorkflowId: string | null }[]
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
  'agent-session-send': (data: { sessionId: string; input: string }) => void
  'agent-session-fork': (data: { sessionId: string; targetWorkflowId: string }) => Promise<{
    sessionId: string
    sessionType: 'normal' | 'fork'
    origin: { sessionId: string; workflowId: string | null } | null
    activeBranch: string
    branches: { name: string; headWorkflowId: string | null; sourceWorkflowId: string | null }[]
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
  'agent-workflow-regenerate': (data: {
    sessionId: string
    targetWorkflowId: string
    branchName: string
    input?: string
  }) => void
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
  'submit-generate-image-settings': (data: GenerateImageConfig) => void
  // only dev
  'dev-delete-database-rows': () => void

  'workspace-get-info': (data?: { workspacePath?: string | null }) => Promise<{
    workspacePath: string | null
    videHome: string
    artifactsPath: string
    skillsPath: string
  }>
  'workspace-select-directory': () => Promise<{
    workspacePath: string | null
    videHome: string
    artifactsPath: string
    skillsPath: string
  } | null>
  'reveal-path-in-explorer': (data: { path: string }) => Promise<void>
  'get-skills-list': () => Promise<
    {
      name: string
      description: string
      filePath: string
    }[]
  >

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
