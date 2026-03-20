import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { ToolCall } from '@/agent/core/types'
import type { WorkflowState } from '../../hooks/createWorkflowStream'
import { ThreadEventHandler } from './threadEventHandler'

/* ---------------- planner ---------------- */

export type PlanStep = {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

/* ---------------- messages ---------------- */

export type ThreadMessage =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant-reason'; content: string }
  | { id: string; role: 'assistant-text'; content: string }
  | { id: string; role: 'tool-call'; toolCalls: ToolCall[] }
  | { id: string; role: 'tool-result'; toolCallId: string; result: any }
  | { id: string; role: 'error'; error: any }

/* ---------------- block ---------------- */

export type ConversationBlock = {
  id: string

  status: 'running' | 'finished' | 'error'

  input: string

  messages: ThreadMessage[]

  askUser?: {
    completed: boolean
    submitValue: []
    title: string
    description: string
    type: string
    options: { label: string; value: string; description: string }[]
  }

  runtime: {
    isStreaming: boolean
    streamingReason: boolean
    streamingText: boolean
    runningToolId?: string
    waitingHuman: boolean
  }
}

/* ---------------- state ---------------- */

export type ThreadState = {
  streaming: boolean
  sessionId?: string

  planner: { id: string; plan: PlanStep[] }[]

  blocks: ConversationBlock[]

  currentBlockId?: string
  currentPlannerId?: string

  artifacts: {
    id: string
    threadId: string
    artifactWorkspaceName: string
    createdAt: number
    updatedAt: number
  }[]
}

/* ---------------- actions ---------------- */

type ThreadActions = {
  handleEvent: (event: WorkflowState) => void
  reset: () => void
  buildFromDatabase: (data: ThreadState) => void
}

/* ---------------- store ---------------- */

export const useThreadStore = create<ThreadState & ThreadActions>()(
  immer((set) => ({
    streaming: false,
    blocks: [],
    planner: [],
    artifacts: [],
    reset() {
      set((state) => {
        state.blocks = []
        state.sessionId = undefined
        state.currentBlockId = undefined
        state.planner = []
        state.currentPlannerId = undefined
        state.artifacts = []
        state.streaming = false
      })
    },

    handleEvent(event) {
      set((state) => {
        new ThreadEventHandler(state, event).run()
      })
    },

    buildFromDatabase(data) {
      set((state) => {
        state.blocks = data.blocks
        state.sessionId = data.sessionId
        state.currentBlockId = data.currentBlockId
        state.planner = data.planner
        state.artifacts = data.artifacts
        state.streaming = data.streaming
      })
    },
  }))
)
