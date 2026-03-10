import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'

import type { PlanStep } from '@/agent/core/agentSession'
import type { ToolCall } from '@/agent/core/types'
import type { WorkflowState } from '../hooks/createWorkflowStream'

/* ---------------- message ---------------- */

export type ThreadMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant-text'; content: string }
  | { role: 'assistant-reason'; content: string }
  | { role: 'tool-call'; toolCalls: ToolCall[] }
  | { role: 'tool-result'; id: string; result: any }
  | { role: 'error'; error: any }

/* ---------------- workflow ---------------- */

export type WorkflowBlock = {
  id: string
  type: 'workflow'
  status: 'running' | 'finished' | 'error'
  messages: ThreadMessage[]
}

/* ---------------- plan step ---------------- */

export type PlanStepBlock = {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  workflow?: WorkflowBlock
}

/* ---------------- blocks ---------------- */

export type NormalBlock = {
  id: string
  type: 'normal'
  input: string
  status: 'in_analyzeing' | 'running' | 'finished' | 'error'
  messages: ThreadMessage[]
}

export type PlanBlock = {
  id: string
  type: 'plan'
  input: string
  plannerId: string
  status:
    | 'in_analyzeing'
    | 'plan_generating'
    | 'plan_ready_execute'
    | 'running'
    | 'finished'
    | 'error'
  steps: PlanStepBlock[]
}

export type ConversationBlock = NormalBlock | PlanBlock

/* ---------------- thread state ---------------- */

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

function getRunningStep(block: PlanBlock) {
  return block.steps.find((s) => s.status === 'running')
}

function getWorkflowMessages(block: ConversationBlock): ThreadMessage[] | undefined {
  if (block.type === 'normal') return block.messages

  const step = getRunningStep(block)

  return step?.workflow?.messages
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
        const block = getCurrentBlock(state)

        switch (type) {
          /* ---------------- session ---------------- */

          case 'agent-create-session': {
            state.sessionId = data.sessionId
            return
          }

          case 'agent-session-start-analyze-input': {
            const newBlock: NormalBlock = {
              id: nanoid(),
              type: 'normal',
              input: data.userInput,
              status: 'in_analyzeing',
              messages: [
                {
                  role: 'user',
                  content: data.userInput,
                },
              ],
            }

            state.blocks.push(newBlock)
            state.currentBlockId = newBlock.id
            return
          }

          case 'agent-session-end-analyze-input': {
            if (!block) return

            if (data.mode === 'plan') {
              const planBlock: PlanBlock = {
                id: block.id,
                type: 'plan',
                input: block.input,
                plannerId: '',
                status: 'plan_generating',
                steps: [],
              }

              state.blocks[state.blocks.length - 1] = planBlock
            } else {
              state.blocks[state.blocks.length - 1].status = 'running'
            }
            return
          }

          /* ---------------- planner ---------------- */

          case 'planner-start-generate': {
            if (!block || block.type !== 'plan') return

            block.plannerId = data.plannerId
            block.status = 'plan_generating'
            return
          }

          case 'planner-step-generate': {
            if (!block || block.type !== 'plan') return

            block.plannerId = data.plannerId
            block.status = 'plan_generating'
            block.steps.push({
              id: data.plan.id,
              title: data.plan.description,
              status: 'pending',
            })
            return
          }

          case 'planner-end-generate': {
            if (!block || block.type !== 'plan') return

            block.plannerId = data.plannerId
            block.status = 'plan_ready_execute'

            block.steps = data.plans.map((p: PlanStep) => ({
              id: p.id,
              title: p.description,
              status: 'pending',
            }))

            return
          }

          case 'planner-execute-item-start': {
            if (!block || block.type !== 'plan') return

            const step = block.steps.find((s) => s.id === data.plan.id)

            if (!step) return

            step.status = 'running'

            step.workflow = {
              id: nanoid(),
              type: 'workflow',
              status: 'running',
              messages: [],
            }

            block.status = 'running'

            return
          }

          case 'planner-execute-item-success': {
            if (!block || block.type !== 'plan') return

            const step = block.steps.find((s) => s.id === data.plan.id)

            if (step) step.status = 'completed'

            return
          }

          case 'planner-execute-item-error': {
            if (!block || block.type !== 'plan') return

            const step = block.steps.find((s) => s.id === data.plan.id)

            if (step) step.status = 'failed'

            block.status = 'error'

            return
          }

          /* ---------------- workflow lifecycle ---------------- */

          case 'workflow-finished': {
            if (!block) return

            if (block.type === 'normal') block.status = 'finished'

            if (block.type === 'plan') {
              const step = getRunningStep(block)
              if (step?.workflow) step.workflow.status = 'finished'
            }

            return
          }

          case 'workflow-error': {
            if (!block) return

            const messages = getWorkflowMessages(block)

            messages?.push({
              role: 'error',
              error: data.error,
            })

            if (block.type === 'normal') block.status = 'error'

            return
          }

          /* ---------------- reasoning ---------------- */

          case 'workflow-llm-reasoning-start': {
            if (!block) return

            const messages = getWorkflowMessages(block)

            messages?.push({
              role: 'assistant-reason',
              content: '',
            })

            return
          }

          case 'workflow-llm-reasoning-delta': {
            if (!block) return

            const messages = getWorkflowMessages(block)
            const last = messages?.at(-1)

            if (last?.role === 'assistant-reason') {
              last.content += data.chunk.delta
            }

            return
          }

          /* ---------------- text ---------------- */

          case 'workflow-llm-text-start': {
            if (!block) return

            const messages = getWorkflowMessages(block)

            messages?.push({
              role: 'assistant-text',
              content: '',
            })

            return
          }

          case 'workflow-llm-text-delta': {
            if (!block) return

            const messages = getWorkflowMessages(block)
            const last = messages?.at(-1)

            if (last?.role === 'assistant-text') {
              last.content += data.chunk.delta
            }

            return
          }

          /* ---------------- tool calls ---------------- */

          case 'workflow-llm-tool-calls-start': {
            if (!block) return

            const messages = getWorkflowMessages(block)

            messages?.push({
              role: 'tool-call',
              toolCalls: [],
            })

            return
          }

          case 'workflow-llm-tool-call-name': {
            if (!block) return

            const messages = getWorkflowMessages(block)
            const last = messages?.at(-1)

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
            if (!block) return

            const messages = getWorkflowMessages(block)
            const last = messages?.at(-1)

            if (last?.role !== 'tool-call') return

            const tool = last.toolCalls.find((t) => t.id === data.data.id)

            if (tool) tool.function.arguments = data.data.arguments

            return
          }

          /* ---------------- tool result ---------------- */

          case 'workflow-tool-call-start': {
            if (!block) return

            const messages = getWorkflowMessages(block)

            messages?.push({
              role: 'tool-result',
              id: data.toolCall.id,
              result: '',
            })

            return
          }

          case 'workflow-tool-call-success': {
            if (!block) return

            const messages = getWorkflowMessages(block)
            const last = messages?.at(-1)

            if (last?.role === 'tool-result') {
              last.result = data.toolCallResult.result
            }

            return
          }

          case 'workflow-tool-call-error': {
            if (!block) return

            const messages = getWorkflowMessages(block)
            const last = messages?.at(-1)

            if (last?.role === 'tool-result') {
              last.result = data.toolCallResult.error
            }

            return
          }
        }
      })
    },
  }))
)
