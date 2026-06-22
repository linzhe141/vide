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

export const enum SessionMessageRole {
  System = 'system',
  User = 'user',
  AssistantReason = 'assistant-reason',
  AssistantText = 'assistant-text',
  ToolCalls = 'tool-calls',
  Tool = 'tool',
  Error = 'error',
  Abort = 'abort',
}
//
// export * from './planner'
