import type {
  Settings,
  GenerateImageConfig,
  LLMConfig,
  FileNode,
  SessionRowDto,
  WorkflowData,
  WebSearchConfig,
  WechatBotRuntimeStatus,
} from '@vide/config'
import type { WorkflowEvent, SessionEvent } from '@vide/agent'

export type { FileNode, SessionRowDto, WorkflowData }

export type WorkspaceExplorerNode = {
  name: string
  type: 'file' | 'folder'
  path: string
  target: string[]
  children?: WorkspaceExplorerNode[]
  content?: WorkspaceFilePreview
}

export type WorkspaceFilePreview =
  | {
      kind: 'folder'
      path: string
    }
  | {
      kind: 'text'
      path: string
      content: string
      truncated: boolean
    }
  | {
      kind: 'image'
      path: string
      fileUrl: string
    }
  | {
      kind: 'video'
      path: string
      fileUrl: string
    }
  | {
      kind: 'binary'
      path: string
      message: string
    }
  | {
      kind: 'missing'
      path: string
      message: string
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

  // wechat bot
  'wechat-get-qrcode': () => Promise<{ ok: true }>
  'wechat-start-bot': () => { ok: true } | { ok: false; error: string }
  'wechat-stop-bot': () => Promise<void>
  'wechat-logout': () => Promise<void>
  'wechat-get-runtime-status': () => WechatBotRuntimeStatus
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
  'get-workspace-files': (data: {
    workspacePath: string
    target: string[]
  }) => Promise<WorkspaceExplorerNode[]>
  'get-workspace-file-content': (data: {
    workspacePath: string
    target: string[]
    maxBytes?: number
  }) => Promise<WorkspaceFilePreview>
  'workspace-files-watch-start': (data: { workspacePath: string }) => Promise<void>
  'workspace-files-watch-stop': (data: { workspacePath: string }) => Promise<void>
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

  'weixin-bot-auth-success': () => void

  'workspace-file-changed': (data: {
    workspacePath: string
    event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
    path: string
    target: string[]
    parentTarget: string[]
    name: string
    type: 'file' | 'folder'
  }) => void

  // agent：后台入口（如微信 Bot）触发一次发送
  'agent-session-background-send': (data: { sessionId: string }) => void
} & {
  // agent workflow + session 级事件（统一的 mapped type，避免多个合并类型互相干扰）
  [K in WorkflowEvent['type'] | SessionEvent['type']]: K extends SessionEvent['type']
    ? (data: Extract<SessionEvent, { type: K }>) => void
    : K extends WorkflowEvent['type']
      ? (data: Extract<WorkflowEvent, { type: K }> & {
          ctx: { sessionId: string | null; workflowId: string | null }
        }) => void
      : never
}
