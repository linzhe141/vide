import type {
  Settings,
  GenerateImageConfig,
  LLMConfig,
  FileNode,
  SessionRowDto,
  WorkflowData,
} from '@vide/config'
import type { AgentLifecycleEvents, WorkflowEvents } from '@vide/agent/event'
import type { PlanStep, WaitHumanApprovePayload } from '@vide/agent/types'

export type { FileNode, SessionRowDto, WorkflowData }

export interface RenderChannel {
  // electron store
  'get-settings-store': () => Settings
  'dispatch-settings-store': (data: Record<string, unknown>) => void

  // window
  'maxmize-window': () => void
  'minmize-window': () => void
  'close-window': () => void

  // agent
  'agent-create-session': (data: {
    workspacePath: string | null
    autoApprove: boolean
  }) => Promise<string>
  'agent-resume-session': (data: { sessionId: string }) => Promise<{
    sessionType: 'normal' | 'fork'
    title: string
    origin: { sessionId: string; workflowId: string | null } | null
    activeBranch: string
    branches: { name: string; headWorkflowId: string | null; sourceWorkflowId: string | null }[]
    planner: { id: string; plan: PlanStep[] }[]
    workflowData: WorkflowData[]
    autoApprove: boolean
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
  'agent-human-approved': (data: {
    sessionId: string
    workflowId: string
    payload: WaitHumanApprovePayload
  }) => void
  'agent-human-rejected': (data: {
    sessionId: string
    workflowId: string
    payload: WaitHumanApprovePayload
  }) => void
  'agent-workflow-abort': (data: { sessionId: string; workflowId: string }) => void
  'agent-session-switch-auto-approve': (data: { sessionId: string; autoApprove: boolean }) => void
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
  //
  'query-workflow-is-completed': (data: {
    sessionId: string
    workflowId: string
  }) => Promise<boolean>
  'resume-running-workflow': (data: { sessionId: string; workflowId: string }) => Promise<void>
}

export type MainChannel = {
  'changed-window-size': (isMaximized: boolean) => void
} & AgentLifecycleEvents &
  WorkflowEvents
