import type { Settings } from '@/electron/store/settingsStore'
import type { LLMConfig, ThreadMessageRole } from '@/types'
import type {
  AgentLifecycleEvents,
  PlannerEvents,
  WorkflowEvents,
} from '@/agent/core/event/channels'

export type ThreadMessageRowDto = {
  id: string
  sessionId: string
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
  'agent-change-session': (data: { sessionId: string }) => Promise<boolean>

  // thread message
  'get-threads-list': () => Promise<ThreadRowDto[]>
  'get-threads-item-messages': (data: { sessionId: string }) => Promise<ThreadMessageRowDto[]>

  // submit llm settings
  'submit-llm-seetings': (data: LLMConfig) => void
  'verify-llm-settings-connection': (
    data: LLMConfig
  ) => Promise<{ success: true } | { success: false; error: any }>
}

export type MainChannel = {
  // example
  sendChunk: (chunk: string) => void
  foo: (data: Record<'foo', 'bar'>) => void
  ping: () => void

  // window
  'changed-window-size': (isMaximized: boolean) => void
} & AgentLifecycleEvents &
  PlannerEvents &
  WorkflowEvents
