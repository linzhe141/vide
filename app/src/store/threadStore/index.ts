import { nanoid } from 'nanoid'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { ToolCall } from '@/agent/core/types'
import type { WorkflowState } from '../../hooks/createWorkflowStream'

export type PlanStep = {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export type ThreadMessage =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant-reason'; content: string }
  | { id: string; role: 'assistant-text'; content: string }
  | { id: string; role: 'tool-call'; toolCalls: ToolCall[] }
  | { id: string; role: 'tool-result'; toolCallId: string; result: any }
  | { id: string; role: 'error'; error: any }

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
          const { type, data } = event
          const sessionId = getEventSessionId(event)
          const thread = sessionId
            ? state.threads.find((item) => item.sessionId === sessionId)
            : undefined
          const block =
            thread && thread.currentBlockId
              ? thread.blocks.find((item) => item.id === thread.currentBlockId)
              : undefined
          const planner = thread ? getCurrentPlanner(thread) : undefined

          switch (type) {
            case 'workflow-start': {
              const { sessionId, workflowId } = data.ctx
              const targetThread = getOrCreateThread(state, sessionId)

              targetThread.blocks.push(createConversationBlock(workflowId, data.input))
              targetThread.currentBlockId = workflowId
              return
            }

            case 'workflow-finished': {
              if (!block) return
              block.status = 'finished'
              return
            }

            case 'workflow-error': {
              console.error(data)
              if (!block) return

              block.status = 'error'
              pushMessage(block, {
                id: nanoid(),
                role: 'error',
                error: data.error instanceof Error ? data.error.message : data.error,
              })
              return
            }

            case 'workflow-wait-human-approve': {
              if (!block) return
              block.runtime.waitingHuman = true
              return
            }

            case 'workflow-llm-start': {
              if (!block) return
              block.runtime.isStreaming = true
              return
            }

            case 'workflow-llm-end': {
              if (!block) return
              block.runtime.isStreaming = false
              block.runtime.streamingReason = false
              block.runtime.streamingText = false
              return
            }

            case 'workflow-llm-reasoning-start': {
              if (!block) return
              block.runtime.streamingReason = true
              return
            }

            case 'workflow-llm-reasoning-delta': {
              if (!block) return
              const msg = ensureLastMessage(block, 'assistant-reason')
              msg.content += data.chunk.delta
              return
            }

            case 'workflow-llm-reasoning-end': {
              if (!block) return
              block.runtime.streamingReason = false
              return
            }

            case 'workflow-llm-text-start': {
              if (!block) return
              block.runtime.streamingText = true
              return
            }

            case 'workflow-llm-text-delta': {
              if (!block) return
              const msg = ensureLastMessage(block, 'assistant-text')
              msg.content += data.chunk.delta
              return
            }

            case 'workflow-llm-text-end': {
              if (!block) return
              block.runtime.streamingText = false
              return
            }

            case 'workflow-llm-tool-calls-end': {
              if (!block) return
              pushMessage(block, {
                id: nanoid(),
                role: 'tool-call',
                toolCalls: data.toolCalls,
              })
              return
            }

            case 'workflow-tool-call-start': {
              if (!block) return
              block.runtime.runningToolId = data.toolCall.id
              return
            }

            case 'workflow-tool-call-success': {
              if (!block) return
              block.runtime.runningToolId = undefined
              pushMessage(block, {
                id: nanoid(),
                role: 'tool-result',
                toolCallId: data.toolCallResult.id,
                result: data.toolCallResult.result,
              })
              return
            }

            case 'workflow-tool-call-error': {
              if (!block) return
              block.runtime.runningToolId = undefined
              pushMessage(block, {
                id: nanoid(),
                role: 'error',
                error: data.toolCallResult.error,
              })
              return
            }

            case 'ask-user-start-generate': {
              if (!block) return
              block.askUser = {
                completed: false,
                submitValue: [],
                title: data.title,
                description: data.description,
                type: data.type,
                options: [],
              }
              return
            }

            case 'ask-user-option': {
              if (!block?.askUser) return
              block.askUser.options.push(data.option)
              return
            }

            case 'ask-user-complete': {
              if (!block?.askUser) return
              block.askUser.completed = true
              return
            }

            case 'planner-start-generate': {
              if (!thread) return
              thread.currentPlannerId = data.plannerId
              thread.planner.push({
                id: data.plannerId,
                plan: [],
              })
              return
            }

            case 'planner-step-generate': {
              if (!planner) return
              planner.plan.push(data.plan)
              return
            }

            case 'planner-execute-item-start': {
              const step = planner?.plan.find((item) => item.id === data.plan.id)
              if (!step) return
              step.status = 'running'
              return
            }

            case 'planner-execute-item-success': {
              const step = planner?.plan.find((item) => item.id === data.plan.id)
              if (!step) return
              step.status = 'completed'
              return
            }

            case 'planner-execute-item-error': {
              const step = planner?.plan.find((item) => item.id === data.plan.id)
              if (!step) return
              step.status = 'failed'
              return
            }
          }
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

function createConversationBlock(workflowId: string, input: string): ConversationBlock {
  return {
    id: workflowId,
    input,
    status: 'running',

    messages: [
      {
        id: nanoid(),
        role: 'user',
        content: input,
      },
    ],

    runtime: {
      isStreaming: false,
      streamingReason: false,
      streamingText: false,
      waitingHuman: false,
    },
  }
}

function getOrCreateThread(state: ThreadState, sessionId: string) {
  let thread = state.threads.find((item) => item.sessionId === sessionId)
  if (thread) return thread

  thread = {
    sessionId,
    planner: [],
    blocks: [],
    artifacts: [],
  }
  state.threads.push(thread)

  return thread
}

function ensureLastMessage(block: ConversationBlock, role: ThreadMessage['role']) {
  const last = block.messages.at(-1)

  if (!last || last.role !== role) {
    const msg = {
      id: nanoid(),
      role,
      content: '',
    } as any

    block.messages.push(msg)

    return msg
  }

  return last
}

function pushMessage(block: ConversationBlock, message: ThreadMessage) {
  block.messages.push(message)
}

function getCurrentPlanner(state: Thread) {
  return state.planner.find((b) => b.id === state.currentPlannerId)
}

function getEventSessionId(event: WorkflowState) {
  if ('ctx' in event.data) {
    return event.data.ctx.sessionId
  }

  if ('sessionId' in event.data) {
    return event.data.sessionId
  }

  return undefined
}
