import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'

import type { ToolCall } from '@/agent/core/types'
import type { WorkflowState } from '../hooks/createWorkflowStream'

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

  planner?: {
    plannerId?: string
    steps: PlanStep[]
  }

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

  createdAt: number
  finishedAt?: number
}

/* ---------------- state ---------------- */

type ThreadState = {
  sessionId?: string

  blocks: ConversationBlock[]

  currentBlockId?: string
}

/* ---------------- actions ---------------- */

type ThreadActions = {
  handleEvent: (event: WorkflowState) => void
  reset: () => void
}

/* ---------------- helpers ---------------- */

function getCurrentBlock(state: ThreadState) {
  return state.blocks.find((b) => b.id === state.currentBlockId)
}

function pushMessage(block: ConversationBlock, message: ThreadMessage) {
  block.messages.push(message)
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

/* ---------------- store ---------------- */

export const useThreadStore = create<ThreadState & ThreadActions>()(
  immer((set) => ({
    blocks: [],

    reset() {
      set((state) => {
        state.blocks = []
        state.sessionId = undefined
        state.currentBlockId = undefined
      })
    },

    handleEvent(event) {
      const { type, data } = event

      set((state) => {
        let block = getCurrentBlock(state)

        switch (type) {
          /* ---------------- workflow lifecycle ---------------- */

          case 'workflow-start': {
            const id = nanoid()

            block = {
              id,
              input: data.input,
              status: 'running',

              messages: [
                {
                  id: nanoid(),
                  role: 'user',
                  content: data.input,
                },
              ],

              runtime: {
                isStreaming: false,
                streamingReason: false,
                streamingText: false,
                waitingHuman: false,
              },

              createdAt: Date.now(),
            }
            const prevBlock = state.blocks.at(-1)
            // 同步未完成的planner
            if (prevBlock?.planner) {
              block.planner = prevBlock.planner
            }
            state.blocks.push(block)
            state.currentBlockId = id

            return
          }

          case 'workflow-finished': {
            if (!block) return

            block.status = 'finished'
            block.runtime.isStreaming = false
            block.finishedAt = Date.now()

            return
          }

          case 'workflow-error': {
            if (!block) return

            block.status = 'error'

            pushMessage(block, {
              id: nanoid(),
              role: 'error',
              error: data.error,
            })

            return
          }

          case 'workflow-wait-human-approve': {
            if (!block) return

            block.runtime.waitingHuman = true
            return
          }

          /* ---------------- llm lifecycle ---------------- */

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

          /* ---------------- reasoning stream ---------------- */

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

          /* ---------------- assistant text ---------------- */

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

          /* ---------------- tool calls ---------------- */

          case 'workflow-llm-tool-calls-end': {
            if (!block) return

            pushMessage(block, {
              id: nanoid(),
              role: 'tool-call',
              toolCalls: data.toolCalls,
            })

            return
          }

          /* ---------------- tool execution ---------------- */

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

          /* ---------------- planner ---------------- */

          case 'planner-start-generate': {
            if (!block) return
            block.planner = {
              plannerId: data.plannerId,
              steps: [],
            }

            return
          }

          case 'planner-step-generate': {
            if (!block) return
            if (!block.planner) {
              block.planner = {
                plannerId: data.plannerId,
                steps: [],
              }
            }

            block.planner.steps.push(data.plan)
            return
          }

          case 'planner-execute-item-start': {
            if (!block?.planner) return

            const step = block.planner.steps.find((s) => s.id === data.plan.id)

            if (step) step.status = 'running'

            return
          }

          case 'planner-execute-item-success': {
            if (!block?.planner) return

            const step = block.planner.steps.find((s) => s.id === data.plan.id)

            if (step) step.status = 'completed'

            return
          }

          case 'planner-execute-item-error': {
            if (!block?.planner) return

            const step = block.planner.steps.find((s) => s.id === data.plan.id)

            if (step) step.status = 'failed'

            return
          }

          /* ---------------- ask uer question ---------------- */

          case 'ask-user-start-generate': {
            if (!block) return
            block.askUser = {
              completed: false,
              submitValue: [],
              title: '',
              description: '',
              type: data.type,
              options: [],
            }

            return
          }

          case 'ask-user-title': {
            if (!block) return
            if (block.askUser) {
              block.askUser.title = data.title
            }
            return
          }
          case 'ask-user-description': {
            if (!block) return
            if (block.askUser) {
              block.askUser.description = data.description
            }
            return
          }

          case 'ask-user-option': {
            if (!block) return
            if (block.askUser) {
              block.askUser.options.push(data.option)
            }
            return
          }
          case 'ask-user-complete': {
            if (!block) return
            if (block.askUser) {
              block.askUser.completed = true
            }
            return
          }
        }
      })
    },
  }))
)
