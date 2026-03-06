import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'

import type { PlanStep } from '@/agent/core/agentSession'
import type { ToolCall } from '@/agent/core/types'
import type { WorkflowState } from '../hooks/createWorkflowStream'

// TODO
// export type UserChatMessage = {
//   role: ThreadMessageRole.User
//   content: string
// }

// export type AssistantChatReasonMessage = {
//   reasoning: boolean
//   role: ThreadMessageRole.AssistantReason
//   content: string
// }

// export type AssistantChatTextMessage = {
//   role: ThreadMessageRole.AssistantText
//   content: string
// }

// export type ToolCallsChatMessage = {
//   role: ThreadMessageRole.ToolCalls
//   tool_calls: Array<ToolCall & { result?: string; status: 'pending' | 'approve' | 'reject' }>
// }

// export type WorkflowErrorChatMessage = {
//   role: ThreadMessageRole.Error
//   error: any
// }

// type ThreadMessage =
//   | UserChatMessage
//   | AssistantChatReasonMessage
//   | AssistantChatTextMessage
//   | ToolCallsChatMessage
//   | WorkflowErrorChatMessage

export type ThreadMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant-text'; content: string }
  | { role: 'assistant-reason'; content: string }
  | { role: 'tool-call'; toolCalls: ToolCall[] }
  | { role: 'tool-result'; id: string; result: any }
  | { role: 'error'; error: any }

export type PlannerState = {
  plannerId: string
  status: 'generating' | 'ready' | 'running' | 'finished'
  plans: PlanStep[]
}

export type WorkflowStateStore = {
  workflowId: string
  status: 'running' | 'finished' | 'error'
}

export type ConversationBlock = {
  id: string

  input: string

  status: 'analyzing' | 'running' | 'finished' | 'error'

  mode?: 'plan' | 'normal'

  messages: ThreadMessage[]

  planner?: PlannerState

  workflows: WorkflowStateStore[]
}

type ThreadState = {
  sessionId?: string

  blocks: ConversationBlock[]

  currentBlockId?: string
}

type ThreadActions = {
  handleEvent: (event: WorkflowState) => void

  reset: () => void
}

export const useThreadStore = create<ThreadState & ThreadActions>()(
  immer((set) => ({
    blocks: [],

    reset() {
      set((state) => {
        state.currentBlockId = ''
        state.sessionId = ''
        state.blocks = []
        return
      })
    },

    handleEvent(event) {
      const { type, data } = event

      set((state) => {
        const getBlock = () => state.blocks.find((b) => b.id === state.currentBlockId)

        switch (type) {
          case 'agent-create-session': {
            state.sessionId = data.sessionId
            return
          }
          case 'agent-session-start-analyze-input': {
            console.log('xxxxxxxxxxxxx', data)
            const block: ConversationBlock = {
              id: nanoid(),
              input: data.userInput,
              status: 'analyzing',
              messages: [
                {
                  role: 'user',
                  content: data.userInput,
                },
              ],
              workflows: [],
            }

            state.blocks.push(block)
            state.currentBlockId = block.id
            return
          }
          case 'agent-session-end-analyze-input': {
            const block = getBlock()
            if (!block) return

            block.mode = data.mode
            block.status = 'running'
            return
          }

          case 'agent-session-finished': {
            // TODO
            return
          }

          case 'planner-start-generate': {
            const block = getBlock()
            if (!block) return

            block.planner = {
              plannerId: data.plannerId,
              status: 'generating',
              plans: [],
            }

            return
          }

          case 'planner-end-generate': {
            const block = getBlock()
            if (!block) return

            block.planner = {
              plannerId: data.plannerId,
              status: 'ready',
              plans: data.plans,
            }

            return
          }
          case 'planner-execute-item-start': {
            const block = getBlock()
            if (!block?.planner) return

            block.planner.status = 'running'
            return
          }
          case 'planner-execute-item-success': {
            const block = getBlock()
            if (!block?.planner) return

            return
          }
          case 'planner-execute-item-error': {
            const block = getBlock()
            if (!block?.planner) return

            block.status = 'error'
            return
          }

          case 'workflow-start': {
            const block = getBlock()
            if (!block) return

            block.workflows.push({
              workflowId: data.ctx.workflowId,
              status: 'running',
            })

            return
          }
          case 'workflow-finished': {
            const block = getBlock()
            if (!block) return

            const wf = block.workflows.find((w) => w.workflowId === data.ctx.workflowId)

            if (wf) wf.status = 'finished'

            block.status = 'finished'

            return
          }
          case 'workflow-wait-human-approve': {
            // TODO
            return
          }
          case 'workflow-error': {
            const block = getBlock()
            if (!block) return

            block.messages.push({
              role: 'error',
              error: data.error,
            })

            block.status = 'error'

            return
          }
          case 'workflow-llm-start': {
            // TODO
            return
          }
          case 'workflow-llm-reasoning-start': {
            const block = getBlock()
            if (!block) return

            block.messages.push({
              role: 'assistant-reason',
              content: '',
            })

            return
          }
          case 'workflow-llm-reasoning-delta': {
            const block = getBlock()
            if (!block) return

            const last = block.messages.at(-1)

            if (last?.role === 'assistant-reason') {
              last.content += data.chunk.delta
            }

            return
          }
          case 'workflow-llm-reasoning-end': {
            // TODO
            return
          }

          case 'workflow-llm-text-start': {
            const block = getBlock()
            if (!block) return

            block.messages.push({
              role: 'assistant-text',
              content: '',
            })

            return
          }
          case 'workflow-llm-text-delta': {
            const block = getBlock()
            if (!block) return

            const last = block.messages.at(-1)

            if (last?.role === 'assistant-text') {
              last.content += data.chunk.delta
            }

            return
          }
          case 'workflow-llm-text-end': {
            // TODO
            return
          }

          case 'workflow-llm-tool-calls-start': {
            const block = getBlock()
            if (!block) return

            block.messages.push({
              role: 'tool-call',
              toolCalls: [],
            })

            return
          }

          case 'workflow-llm-tool-call-name': {
            const block = getBlock()
            if (!block) return

            const last = block.messages.at(-1)

            if (last?.role !== 'tool-call') return

            last.toolCalls.push({
              id: data.data.id,
              type: 'function',
              function: {
                name: data.data.name,
                arguments: '',
              },
            } as ToolCall)

            return
          }
          case 'workflow-llm-tool-call-arguments': {
            const block = getBlock()
            if (!block) return

            const last = block.messages.at(-1)

            if (last?.role !== 'tool-call') return

            const tool = last.toolCalls.find((t) => t.id === data.data.id)

            if (tool) tool.function.arguments = data.data.arguments

            return
          }
          case 'workflow-llm-tool-calls-end': {
            // TODO
            return
          }

          case 'workflow-llm-end': {
            // TODO
            return
          }
          case 'workflow-llm-result': {
            // TODO
            return
          }
          case 'workflow-llm-error': {
            // TODO
            return
          }

          case 'workflow-tool-call-start': {
            const block = getBlock()
            if (!block) return

            block.messages.push({
              role: 'tool-result',
              id: data.toolCall.id,
              result: '',
            })

            return
          }
          case 'workflow-tool-call-success': {
            const block = getBlock()
            if (!block) return
            const last = block.messages.at(-1)
            if (last?.role === 'tool-result') {
              last.result = data.toolCallResult.result
            }

            return
          }
          case 'workflow-tool-call-error': {
            const block = getBlock()
            if (!block) return
            const last = block.messages.at(-1)
            if (last?.role === 'tool-result') {
              last.result = data.toolCallResult.error
            }

            return
          }

          case 'workflow-tool-call-reject': {
            const block = getBlock()
            if (!block) return
            const last = block.messages.at(-1)
            if (last?.role === 'tool-result') {
              last.result = data.toolCallResult.reject
            }

            return
          }
        }
      })
    },
  }))
)
