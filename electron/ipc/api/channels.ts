import type {
  AssistantChatMessage,
  CallToolStepPayload,
  FinishReason,
  ToolCall,
} from '@/agent/core/types'
import type { Settings } from '@/electron/store/settingsStore'
import type { LLMConfig, ThreadMessageRole } from '@/types'

export type ThreadMessageRowDto = {
  id: string
  threadId: string
  role: ThreadMessageRole
  content: string
  payload: string
  createdAt: number
}

export type ThreadRowDto = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
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
  'agent-create-session': () => Promise<string>
  'agent-session-send': (data: { input: string }) => void
  'agent-human-approved': () => void
  'agent-human-rejected': () => void
  'agent-workflow-abort': () => void
  'agent-change-session': (data: { threadId: string }) => Promise<boolean>

  // thread message
  'get-threads-list': () => Promise<ThreadRowDto[]>
  'get-threads-item-messages': (data: { threadId: string }) => Promise<ThreadMessageRowDto[]>

  // submit llm settings
  'submit-llm-seetings': (data: LLMConfig) => void
  'verify-llm-settings-connection': (
    data: LLMConfig
  ) => Promise<{ success: true } | { success: false; error: any }>
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
  'agent-llm-text-delta': (data: { content: string; delta: string }) => void
  'agent-llm-tool-calls': (data: { toolCalls: ToolCall[] }) => void
  'agent-llm-end': (finishReason: FinishReason) => void
  'agent-llm-result': (message: AssistantChatMessage) => void
  'agent-llm-error': (error: any) => void
  'agent-llm-aborted': () => void
  'agent-tool-call-start': (data: { id: string; toolName: string; args: any }) => void
  'agent-tool-call-success': (data: { id: string; toolName: string; result: any }) => void
  'agent-tool-call-error': (data: { id: string; toolName: string; error: any }) => void
  'agent-workflow-finished': (data: { threadId: string }) => void
  'agent-workflow-wait-human-approve': (data: {
    threadId: string
    payload: CallToolStepPayload
  }) => void
  'agent-workflow-error': (data: { threadId: string; error: any }) => void
  // just for ui
  'agent-llm-tool-calls-start': () => void
  'agent-llm-tool-call-name': (data: { name: string; id: string }) => void
  'agent-llm-tool-call-arguments': (data: { arguments: string; id: string }) => void
  'agent-llm-reasoning-start': () => void
  'agent-llm-reasoning-delta': (data: { reasonContent: string }) => void
  'agent-llm-reasoning-end': () => void
}
