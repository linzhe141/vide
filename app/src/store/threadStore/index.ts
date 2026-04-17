import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { ToolCall } from '@/agent/core/types'
import type { WorkflowState } from '../../hooks/createWorkflowStream'
import { nanoid } from 'nanoid'

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
          switch (type) {
            case 'workflow-start': {
              const { sessionId, workflowId } = data.ctx

              const newBlock: ConversationBlock = {
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
              const targetThread = state.threads.find((i) => i.sessionId === sessionId)
              if (!targetThread) {
                const newThread: Thread = {
                  sessionId,
                  blocks: [newBlock],
                  planner: [],
                  artifacts: [],
                  currentBlockId: workflowId,
                }
                state.threads.push(newThread)
              } else {
                targetThread.blocks.push(newBlock)
              }
              return
            }

            case 'workflow-finished': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)

              if (!block) return
              block.status = 'finished'
              return
            }

            case 'workflow-error': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              console.error(data)

              block.status = 'error'
              pushMessage(block, {
                id: nanoid(),
                role: 'error',
                error: data.error instanceof Error ? data.error.message : data.error,
              })

              return
            }

            case 'workflow-wait-human-approve': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.waitingHuman = true
              return
            }

            /* ---------------- llm lifecycle ---------------- */

            case 'workflow-llm-start': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.isStreaming = true
              return
            }

            case 'workflow-llm-end': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.isStreaming = false
              block.runtime.streamingReason = false
              block.runtime.streamingText = false

              return
            }

            /* ---------------- reasoning stream ---------------- */

            case 'workflow-llm-reasoning-start': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.streamingReason = true
              return
            }

            case 'workflow-llm-reasoning-delta': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              const msg = ensureLastMessage(block, 'assistant-reason')
              msg.content += data.chunk.delta

              return
            }

            case 'workflow-llm-reasoning-end': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.streamingReason = false
              return
            }

            /* ---------------- assistant text ---------------- */

            case 'workflow-llm-text-start': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.streamingText = true
              return
            }

            case 'workflow-llm-text-delta': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              const msg = ensureLastMessage(block, 'assistant-text')
              msg.content += data.chunk.delta

              return
            }

            case 'workflow-llm-text-end': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.streamingText = false
              return
            }

            /* ---------------- tool calls ---------------- */

            case 'workflow-llm-tool-calls-end': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
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
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.runningToolId = data.toolCall.id
              return
            }

            case 'workflow-tool-call-success': {
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
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
              const targetThread = state.threads.find((i) => i.sessionId === data.ctx.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              block.runtime.runningToolId = undefined

              pushMessage(block, {
                id: nanoid(),
                role: 'error',
                error: data.toolCallResult.error,
              })

              return
            }

            /* ---------------- ask user ---------------- */

            case 'ask-user-start-generate': {
              const targetThread = state.threads.find((i) => i.sessionId === data.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
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
              const targetThread = state.threads.find((i) => i.sessionId === data.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              if (block.askUser) {
                block.askUser.options.push(data.option)
              }

              return
            }

            case 'ask-user-complete': {
              const targetThread = state.threads.find((i) => i.sessionId === data.sessionId)
              const block = targetThread?.blocks.find((b) => b.id === targetThread.currentBlockId)
              if (!block) return

              if (block.askUser) {
                block.askUser.completed = true
              }

              return
            }

            /* ---------------- planner ---------------- */

            case 'planner-start-generate': {
              const targetThread = state.threads.find((i) => i.sessionId === data.sessionId)
              if (!targetThread) return
              targetThread.currentPlannerId = data.plannerId

              targetThread.planner.push({
                id: data.plannerId,
                plan: [],
              })

              return
            }

            case 'planner-step-generate': {
              const targetThread = state.threads.find((i) => i.sessionId === data.sessionId)
              if (!targetThread) return
              const planner = getCurrentPlanner(targetThread)
              if (!planner) return

              planner.plan.push(data.plan)
              return
            }

            case 'planner-execute-item-start': {
              const targetThread = state.threads.find((i) => i.sessionId === data.sessionId)
              if (!targetThread) return
              const planner = getCurrentPlanner(targetThread)
              if (!planner) return

              const step = planner.plan.find((s) => s.id === data.plan.id)
              if (step) step.status = 'running'

              return
            }

            case 'planner-execute-item-success': {
              const targetThread = state.threads.find((i) => i.sessionId === data.sessionId)
              if (!targetThread) return
              const planner = getCurrentPlanner(targetThread)
              if (!planner) return

              const step = planner.plan.find((s) => s.id === data.plan.id)
              if (step) step.status = 'completed'

              return
            }

            case 'planner-execute-item-error': {
              const targetThread = state.threads.find((i) => i.sessionId === data.sessionId)
              if (!targetThread) return
              const planner = getCurrentPlanner(targetThread)
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
          // state.threads.push(data)
          console.log('todo buildFromDatabase', data, state)
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
