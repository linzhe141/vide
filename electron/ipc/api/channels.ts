import type { Settings } from '@/electron/store/settingsStore'
import type { LLMConfig, ThreadMessageRole } from '@/types'
import type {
  AgentLifecycleEvents,
  PlannerEvents,
  WorkflowEvents,
  AskUserQuestionEvents,
} from '@/agent/core/event/channels'
import type { threadWorkflowBlockMessages } from '@/db/schema'

export type ThreadMessageRowDto = {
  id: string
  blockId: string
  role: ThreadMessageRole
  content: string
  payload: string
  createdAt: number
  updatedAt: number
}

export type ThreadRowDto = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}
type BlockData = {
  id: string
  userInput: string
  messages: (typeof threadWorkflowBlockMessages.$inferSelect)[]
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
  'agent-resume-session': (data: { sessionId: string }) => Promise<BlockData[]>
  'agent-session-send': (data: { input: string }) => void
  'agent-human-approved': () => void
  'agent-human-rejected': () => void
  'agent-workflow-abort': () => void

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
  WorkflowEvents &
  AskUserQuestionEvents
