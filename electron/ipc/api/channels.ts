import type { AssistantChatMessage, FinishReason, ToolCall } from '@/agent/core/types'
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
  'agent-create-session': () => string
  'agent-session-send': (data: { input: string }) => void
  'agent-human-approved': () => void
  'agent-workflow-abort': () => void
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
  'agent-llm-start': () => void
  'agent-llm-delta': (data: { content: string; delta: string }) => void
  'agent-llm-tool-calls': (data: { toolCalls: ToolCall[] }) => void
  'agent-llm-end': (finishReason: FinishReason) => void
  'agent-llm-result': (message: AssistantChatMessage) => void
  'agent-llm-error': (error: any) => void
  'agent-llm-aborted': () => void
  'agent-tool-call-start': (data: { id: string; toolName: string; args: any }) => void
  'agent-tool-call-success': (data: { id: string; toolName: string; result: any }) => void
  'agent-tool-call-error': (data: { id: string; toolName: string; error: any }) => void
  'agent-workflow-finished': (data: { threadId: string }) => void
  'agent-workflow-wait-human-approve': (data: { threadId: string }) => void
}
