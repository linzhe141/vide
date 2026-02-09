import type { Settings } from '@/electron/store/settingsStore'

export type Theme = Settings['theme']
export type ThemeColor = Settings['themeColor']
export type LLMConfig = Settings['llmConfig']

export const enum ThreadMessageRole {
  System = 'system',
  User = 'user',
  AssistantReason = 'assistant-reason',
  AssistantText = 'assistant-text',
  ToolCalls = 'tool-calls',
  Error = 'error',
}
