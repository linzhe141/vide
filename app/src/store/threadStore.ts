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

type ThreadState = {
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

/* ---------------- helpers ---------------- */

function getCurrentBlock(state: ThreadState) {
  return state.blocks.find((b) => b.id === state.currentBlockId)
}
function getCurrentPlanner(state: ThreadState) {
  return state.planner.find((b) => b.id === state.currentPlannerId)
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
      })
    },

    handleEvent(event) {
      const { type, data } = event

      set((state) => {
        let block = getCurrentBlock(state)

        switch (type) {
          /* ---------------- workflow lifecycle ---------------- */

          case 'workflow-start': {
            const workflowId = data.ctx.workflowId
            block = {
              id: workflowId,
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
            }

            state.blocks.push(block)
            state.currentBlockId = workflowId

            return
          }

          case 'workflow-finished': {
            if (!block) return

            block.status = 'finished'
            block.runtime.isStreaming = false

            return
          }

          case 'workflow-error': {
            if (!block) return
            console.error(data)
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

          /* ---------------- ask uer question ---------------- */

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

          /* ---------------- planner ---------------- */

          case 'planner-start-generate': {
            state.currentPlannerId = data.plannerId
            state.planner.push({
              id: data.plannerId,
              plan: [],
            })
            return
          }

          case 'planner-step-generate': {
            const planner = getCurrentPlanner(state)
            if (!planner) return

            planner.plan.push(data.plan)
            return
          }

          case 'planner-execute-item-start': {
            const planner = getCurrentPlanner(state)
            if (!planner) return

            const step = planner.plan.find((s) => s.id === data.plan.id)
            if (step) step.status = 'running'
            return
          }

          case 'planner-execute-item-success': {
            const planner = getCurrentPlanner(state)
            if (!planner) return

            const step = planner.plan.find((s) => s.id === data.plan.id)
            if (step) step.status = 'completed'
            return
          }

          case 'planner-execute-item-error': {
            const planner = getCurrentPlanner(state)
            if (!planner) return

            const step = planner.plan.find((s) => s.id === data.plan.id)
            if (step) step.status = 'failed'
            return
          }
        }
      })
    },

    buildFromDatabase(data) {
      set((state) => {
        state.blocks = data.blocks
        state.sessionId = data.sessionId
        state.currentBlockId = data.currentBlockId
        state.planner = data.planner
        state.artifacts = data.artifacts
      })
    },
  }))
)
