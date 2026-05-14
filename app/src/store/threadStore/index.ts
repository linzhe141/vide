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

export interface UserInputThreadMessage {
  id: string
  role: 'user'
  content: string
}

export interface AssistantReasonThreadMessage {
  id: string
  role: 'assistant-reason'
  content: string
  reasoning: string
}

export interface AssistantTextThreadMessage {
  id: string
  role: 'assistant-text'
  content: string
  reasoning: string
}

export interface ToolCallThreadMessage {
  id: string
  role: 'tool-call'
  toolCalls: ToolCall[]
}

export interface ToolResultThreadMessage {
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

export interface AskUserThreadMessage {
  id: string
  role: 'ask-user'
  completed: boolean
  submitValue: string[]
  title: string
  description: string
  type: 'single' | 'multiple'
  options: { label: string; value: string; description: string }[]
}

export interface ErrorThreadMessage {
  id: string
  role: 'error'
  error: any
}

export type ThreadMessage =
  | UserInputThreadMessage
  | AssistantReasonThreadMessage
  | AssistantTextThreadMessage
  | ToolCallThreadMessage
  | ToolResultThreadMessage
  | AskUserThreadMessage
  | ErrorThreadMessage

export type ConversationBlock = {
  id: string
  parentBlockId: string | null
  childBlockIds: string[]
  status: 'running' | 'finished' | 'error'
  input: string
  messages: ThreadMessage[]
  runtime: {
    isStreaming: boolean
    waitingHuman: boolean
  }
}

export type SessionBranch = {
  name: string
  headBlockId: string | null
}

export type ThreadRuntime = {
  running: boolean
}

export type Thread = {
  sessionId: string
  activeBranch: string
  branches: SessionBranch[]
  planner: { id: string; plan: PlanStep[] }[]
  blockMap: Record<string, ConversationBlock>
  blockOrder: string[]
  currentBlockId?: string
  currentPlannerId?: string
  runtime: ThreadRuntime
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
    updateAskUserSubmitValue: (id: string, value: string[]) => void
    switchBranch: (sessionId: string, branchName: string) => void
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
          const target = state.threads.find((item) => item.sessionId === data.sessionId)
          if (target) return
          state.threads.push(data)
        })
      },
      updateAskUserSubmitValue(id, value) {
        set((state) => {
          for (const thread of state.threads) {
            for (const blockId of thread.blockOrder) {
              const block = thread.blockMap[blockId]
              if (!block) continue
              const msg = block.messages.find((message) => message.id === id)
              if (msg && msg.role === 'ask-user') {
                msg.submitValue = value
                return
              }
            }
          }
        })
      },
      switchBranch(sessionId, branchName) {
        set((state) => {
          const thread = state.threads.find((item) => item.sessionId === sessionId)
          if (!thread) return
          const targetBranch = thread.branches.find((item) => item.name === branchName)
          if (!targetBranch) return
          thread.activeBranch = branchName
          thread.currentBlockId = targetBranch.headBlockId || undefined
        })
      },
    },
  }))
)

export const useThreadStoreActions = () => useThreadStore((state) => state.actions)

export const useThread = (threadId: string) =>
  useThreadStore((state) => state.threads.find((item) => item.sessionId === threadId))

export const useThreadBlocks = (threadId: string) => {
  const thread = useThread(threadId)
  if (!thread) return undefined
  return selectBlocksForActiveBranch(thread)
}

export const useThreadPlanners = (threadId: string) =>
  useThreadStore((state) => state.threads.find((item) => item.sessionId === threadId)?.planner)

export const useThreadRunning = (threadId: string) =>
  useThreadStore((state) => state.threads.find((item) => item.sessionId === threadId)?.runtime.running)

export function selectBlocksForActiveBranch(thread: Thread) {
  const activeBranch = thread.branches.find((item) => item.name === thread.activeBranch)
  const pathIds = buildBlockPath(activeBranch?.headBlockId || null, thread.blockMap)
  return pathIds.map((blockId) => thread.blockMap[blockId]).filter(Boolean)
}

export function buildBlockPath(
  headBlockId: string | null,
  blockMap: Record<string, ConversationBlock>
) {
  const pathIds: string[] = []
  let currentId = headBlockId
  while (currentId) {
    const block = blockMap[currentId]
    if (!block) break
    pathIds.unshift(block.id)
    currentId = block.parentBlockId
  }
  return pathIds
}

export function getNextBranchName(existingBranchNames: string[], prefix = 'branch') {
  let index = existingBranchNames.length + 1
  let candidate = `${prefix}-${index}`
  while (existingBranchNames.includes(candidate)) {
    index += 1
    candidate = `${prefix}-${index}`
  }
  return candidate
}

export function getBranchPathIds(branch: SessionBranch, blockMap: Record<string, ConversationBlock>) {
  return buildBlockPath(branch.headBlockId, blockMap)
}

export function getBranchSelectorOptions(thread: Thread, blockId: string) {
  const branchPaths = thread.branches.map((branch) => ({
    branch,
    pathIds: getBranchPathIds(branch, thread.blockMap),
  }))
  const candidateBranches = branchPaths
    .filter(({ pathIds }) => pathIds.includes(blockId))
    .map(({ branch, pathIds }) => ({
      name: branch.name,
      headBlockId: branch.headBlockId,
      nextBlockId: pathIds[pathIds.indexOf(blockId) + 1] ?? null,
      isActive: branch.name === thread.activeBranch,
    }))

  const grouped = new Map<string, (typeof candidateBranches)[number]>()
  for (const candidate of candidateBranches) {
    const key = candidate.nextBlockId ?? `head:${candidate.headBlockId ?? 'root'}`
    if (!grouped.has(key)) {
      grouped.set(key, candidate)
    }
  }

  return Array.from(grouped.values())
}
