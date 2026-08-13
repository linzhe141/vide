import type {
  Settings,
  GenerateImageConfig,
  LLMConfig,
  FileNode,
  SessionRowDto,
  WorkflowData,
  WebSearchConfig,
} from '@vide/config'
import type { WorkflowEvent } from '@vide/agent'

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
    thinkingMode: boolean
  }) => Promise<string>
  'agent-resume-session': (data: { sessionId: string }) => Promise<{
    sessionType: 'normal' | 'fork'
    title: string
    origin: { sessionId: string; workflowId: string | null } | null
    activeBranch: string
    branches: { name: string; headWorkflowId: string | null; sourceWorkflowId: string | null }[]
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
  'agent-workflow-regenerate': (data: {
    sessionId: string
    targetWorkflowId: string
    branchName: string
    input?: string
  }) => void
  'agent-human-approved': (data: { sessionId: string; workflowId: string }) => void
  'agent-human-rejected': (data: { sessionId: string; workflowId: string }) => void
  'agent-update-user-memory': (data: {
    sessionId: string
    workflowId: string
    feedback?: {
      rating: 'manual' | 'like' | 'dislike'
      reason?: string
    }
  }) => Promise<void>
  'agent-session-switch-auto-approve': (data: { sessionId: string; autoApprove: boolean }) => void
  'agent-session-switch-thinking-mode': (data: { sessionId: string; thinkingMode: boolean }) => void
  'agent-session-abort': (data: { sessionId: string }) => void
  'ask-user-question-submit': (data: { submitValue: string[]; workflowId: string }) => void

  // session message
  'get-sessions-list': () => Promise<SessionRowDto[]>

  // submit llm settings
  'submit-llm-seetings': (data: LLMConfig) => void
  'verify-llm-settings-connection': (
    data: LLMConfig
  ) => Promise<{ success: true } | { success: false; error: any }>
  'submit-generate-image-settings': (data: GenerateImageConfig) => void
  'submit-web-search-settings': (data: WebSearchConfig) => void
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
} & {
  // agent workflow stream events
  [K in WorkflowEvent['type']]: (
    data: Extract<WorkflowEvent, { type: K }> & {
      ctx: { sessionId: string | null; workflowId: string | null }
    }
  ) => void
}
