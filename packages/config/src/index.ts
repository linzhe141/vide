import type { MessageRole } from '@vide/ai'

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
  stopStatus: 'finished' | 'error' | 'aborted'
  feedback: 'like' | 'dislike' | null
  askUserSubmitValue?: string[]
  messages: {
    id: string
    role: MessageRole
    content: string | null
    payload: string | null
    createdAt: number
    updatedAt: number
  }[]
}
