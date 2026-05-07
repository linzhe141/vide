import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { ToolCall } from '@/agent/core/types'
import type { WorkflowState } from '../../hooks/createWorkflowStream'
import { handleWorkflowEvent } from './handleWorkflowEvent'

export type PlanStep = {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export type ThreadMessage =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant-reason'; content: string; reasoning: string }
  | { id: string; role: 'assistant-text'; content: string }
  | { id: string; role: 'tool-call'; toolCalls: ToolCall[] }
  | {
      id: string
      role: 'tool-result'
      toolCallId: string
      status: 'success' | 'error'
      result?: any
      error?: any
      startedAt?: number
      finishedAt?: number
      durationMs?: number
    }
  | {
      id: string
      role: 'ask-user'
      completed: boolean
      submitValue: string[]
      title: string
      description: string
      type: 'single' | 'multiple'
      options: { label: string; value: string; description: string }[]
    }
  | { id: string; role: 'error'; error: any }

export type ConversationBlock = {
  id: string

  status: 'running' | 'finished' | 'error'

  input: string

  messages: ThreadMessage[]

  runtime: {
    isStreaming: boolean
    waitingHuman: boolean
  }
}

export type Thread = {
  sessionId: string

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

export type ThreadState = {
  threads: Thread[]
}

type ThreadActions = {
  actions: {
    handleEvent: (event: WorkflowState) => void
    buildFromDatabase: (data: Thread) => void
  }
}

export const useThreadStore = create<ThreadState & ThreadActions>()(
  immer((set) => ({
    threads: [],
    actions: {
      handleEvent(event) {
        set((state) => {
          handleWorkflowEvent(state, event)
        })
      },
      buildFromDatabase(data) {
        set((state) => {
          // 鍙湁store涓病鏈夊搴旂殑thread鎵嶄粠鏁版嵁搴揵uild
          const target = state.threads.find((i) => i.sessionId === data.sessionId)
          if (target) return
          state.threads.push(data)
        })
      },
    },
  }))
)

export const useThreadStoreActions = () => useThreadStore((state) => state.actions)

export const useThreadBlocks = (threadId: string) =>
  useThreadStore((state) => state.threads.find((i) => i.sessionId === threadId)?.blocks)

export const useThreadPlanners = (threadId: string) =>
  useThreadStore((state) => state.threads.find((i) => i.sessionId === threadId)?.planner)
