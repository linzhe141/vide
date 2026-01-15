import type { ToolCall } from '@/agent/core/types'
import type { Settings } from '@/electron/store/settingsStore'
export interface RenderChannel {
  // electron store
  'get-store': () => Settings
  'dispatch-store': (data: Record<string, unknown>) => void

  // window
  'maxmize-window': () => void
  'minmize-window': () => void
  'close-window': () => void

  // agent
  'agent-create-session': () => void
  'agent-session-send': (data: { input: string }) => void
}

export interface MainChannel {
  // example
  sendChunk: (chunk: string) => void
  foo: (data: Record<'foo', 'bar'>) => void
  ping: () => void

  // window
  'changed-window-size': (isMaximized: boolean) => void

  // agent
  'agent-workflow-start': (data: { threadId: string; input: string }) => void
  'agent-llm-delta': (content: string) => void
  'agent-llm-tool-calls': (data: { toolCalls: ToolCall[] }) => void
  'agent-tool-call-success': (data: { toolName: string; result: any }) => void
  'agent-workflow-finished': (data: { threadId: string }) => void
}
