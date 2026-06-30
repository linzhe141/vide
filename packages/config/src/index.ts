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
}

export type Theme = Settings['theme']
export type ThemeColor = Settings['themeColor']
export type LLMConfig = Settings['llmConfig']
export type GenerateImageConfig = Settings['generateImageConfig']

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
