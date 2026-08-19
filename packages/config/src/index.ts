export type Settings = {
  theme: 'dark' | 'light'
  themeColor: 'blue' | 'green' | 'orange'

  llmConfig: {
    apiKey: string
    baseUrl: string
    model: string
  }

  generateImageConfig: {
    apiKey: string
    baseUrl: string
    model: string
  }

  webSearchConfig: {
    apiKey: string
    searchUrl: string
  }

  wechatBotConfig: WechatBotConfig
}

export type Theme = Settings['theme']
export type ThemeColor = Settings['themeColor']
export type LLMConfig = Settings['llmConfig']
export type GenerateImageConfig = Settings['generateImageConfig']
export type WebSearchConfig = Settings['webSearchConfig']

export type SessionSource = 'desktop' | 'wechat-bot'

/**
 * 微信 ClawBot / iLink Bot 持久化状态。
 * API Base URL、Bot Type、Auto-approve、Thinking mode 均为内置常量，无需用户配置。
 */
export type WechatBotConfig = {
  /** 登录成功后获取到的 bot token（Bearer 鉴权）；非空即视为已认证 */
  botToken: string
  /** 当前激活的 agent 会话 id（用于前端 UI 高亮） */
  activeSessionId: string | null
}

/** 微信扫码状态（get_qrcode_status 返回） */
export type WechatQRCodeStatus =
  | { status: 'pending' | 'scanned' | 'expired' | 'canceled'; [k: string]: unknown }
  | { status: 'confirmed'; bot_token: string; baseurl?: string; [k: string]: unknown }

/** WeChat Bot 的运行状态（供前端展示） */
export type WechatBotRuntimeStatus = {
  connected: boolean
  /** 是否已完成扫码认证（有有效的 botToken） */
  authenticated: boolean
  activeSessionId: string | null
  lastError: string | null
  lastMessageAt: number | null
  messageCount: number
}

/** WeChat Bot 维护的会话记录 */
export type WechatBotSessionRecord = {
  sessionId: string
  label: string
  createdAt: number
  lastUsedAt: number
}

// IPC Types
export type FileNode = {
  name: string
  type: 'file' | 'folder'
  path: string
  content?: string
  children?: FileNode[]
}

export type SessionRowDto = {
  id: string
  title: string
  type: 'normal' | 'fork'
  sessionSource: SessionSource
  originSessionId: string | null
  originWorkflowId: string | null
  workspacePath: string | null
  autoApprove: boolean
  thinkingMode: boolean
  createdAt: number
  updatedAt: number
}

/**
 * workflow 下的 agent message（OpenAI 格式的 AgentMessage）。
 * role 为 agent 侧角色；payload 是完整 AgentMessage 的 JSON 序列化，
 * 前端 load session data 后 JSON.parse 还原成 AgentMessage，再派生到 UI 侧的 message。
 */
export type WorkflowAgentMessageDto = {
  id: string
  role: string
  content: string | null
  payload: string | null
  createdAt: number
}

/**
 * workflow 的完整 stream 日志事件。
 * eventName 对应 WorkflowEvent['type']；payload 为不含 ctx 的事件载荷的 JSON 序列化。
 */
export type WorkflowLogDto = {
  id: string
  eventName: string
  payload: string | null
  createdAt: number
}

/** workflow 的持久化数据（含 agent messages + 完整日志）。 */
export type SessionWorkflowData = {
  id: string
  parentWorkflowId: string | null
  inputSource: SessionSource
  stopStatus: 'completed' | 'error' | 'aborted' | 'interrupted' | null
  feedback: 'like' | 'dislike' | null
  input: string
  agentMessages: WorkflowAgentMessageDto[]
  logs: WorkflowLogDto[]
  createdAt: number
  updatedAt: number
}

export type SessionBranchDto = {
  name: string
  headWorkflowId: string | null
  sourceWorkflowId: string | null
}

/** 加载单个 session 的完整持久化数据，前端据此还原 UI 态（workflow / message / log）。 */
export type SessionDataDto = {
  id: string
  title: string
  type: 'normal' | 'fork'
  sessionSource: SessionSource
  origin: { sessionId: string; workflowId: string | null } | null
  activeBranch: string
  autoApprove: boolean
  thinkingMode: boolean
  workspacePath: string | null
  branches: SessionBranchDto[]
  workflows: SessionWorkflowData[]
  createdAt: number
  updatedAt: number
}
