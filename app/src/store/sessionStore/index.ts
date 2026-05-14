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

export interface UserInputSessionMessage {
  id: string
  role: 'user'
  content: string
}

export interface AssistantReasonSessionMessage {
  id: string
  role: 'assistant-reason'
  content: string
  reasoning: string
}

export interface AssistantTextSessionMessage {
  id: string
  role: 'assistant-text'
  content: string
  reasoning: string
}

export interface ToolCallSessionMessage {
  id: string
  role: 'tool-call'
  toolCalls: ToolCall[]
}

export interface ToolResultSessionMessage {
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

export interface AskUserSessionMessage {
  id: string
  role: 'ask-user'
  completed: boolean
  submitValue: string[]
  title: string
  description: string
  type: 'single' | 'multiple'
  options: { label: string; value: string; description: string }[]
}

export interface ErrorSessionMessage {
  id: string
  role: 'error'
  error: any
}

export type SessionMessage =
  | UserInputSessionMessage
  | AssistantReasonSessionMessage
  | AssistantTextSessionMessage
  | ToolCallSessionMessage
  | ToolResultSessionMessage
  | AskUserSessionMessage
  | ErrorSessionMessage

export type ConversationBlock = {
  id: string
  parentBlockId: string | null
  childBlockIds: string[]
  status: 'running' | 'finished' | 'error'
  input: string
  messages: SessionMessage[]
  runtime: {
    isStreaming: boolean
    waitingHuman: boolean
  }
}

export type SessionBranch = {
  name: string
  headBlockId: string | null
}

export type SessionRuntime = {
  running: boolean
}

export type Session = {
  sessionId: string
  activeBranch: string
  branches: SessionBranch[]
  planner: { id: string; plan: PlanStep[] }[]
  blockMap: Record<string, ConversationBlock>
  blockOrder: string[]
  currentBlockId?: string
  currentPlannerId?: string
  runtime: SessionRuntime
  artifacts: {
    id: string
    sessionId: string
    artifactWorkspaceName: string
    createdAt: number
    updatedAt: number
  }[]
}

export type SessionState = {
  sessions: Session[]
}

type SessionActions = {
  actions: {
    handleEvent: (event: WorkflowState) => void
    buildFromDatabase: (data: Session) => void
    updateAskUserSubmitValue: (id: string, value: string[]) => void
    switchBranch: (sessionId: string, branchName: string) => void
  }
}

export const useSessionStore = create<SessionState & SessionActions>()(
  immer((set) => ({
    sessions: [],
    actions: {
      handleEvent(event) {
        set((state) => {
          handleWorkflowEvent(state, event)
        })
      },
      buildFromDatabase(data) {
        set((state) => {
          const target = state.sessions.find((item) => item.sessionId === data.sessionId)
          if (target) return
          state.sessions.push(data)
        })
      },
      updateAskUserSubmitValue(id, value) {
        set((state) => {
          for (const session of state.sessions) {
            for (const blockId of session.blockOrder) {
              const block = session.blockMap[blockId]
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
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const targetBranch = session.branches.find((item) => item.name === branchName)
          if (!targetBranch) return
          session.activeBranch = branchName
          session.currentBlockId = targetBranch.headBlockId || undefined
        })
      },
    },
  }))
)

export const useSessionStoreActions = () => useSessionStore((state) => state.actions)

export const useSession = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId))

export const useSessionBlocks = (sessionId: string) => {
  const session = useSession(sessionId)
  if (!session) return undefined
  return selectBlocksForActiveBranch(session)
}

export const useSessionPlanners = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId)?.planner)

export const useSessionRunning = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId)?.runtime.running)

export function selectBlocksForActiveBranch(session: Session) {
  const activeBranch = session.branches.find((item) => item.name === session.activeBranch)
  const pathIds = buildBlockPath(activeBranch?.headBlockId || null, session.blockMap)
  return pathIds.map((blockId) => session.blockMap[blockId]).filter(Boolean)
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

export function getBranchSelectorOptions(session: Session, blockId: string) {
  const branchPaths = session.branches.map((branch) => ({
    branch,
    pathIds: getBranchPathIds(branch, session.blockMap),
  }))
  const candidateBranches = branchPaths
    .filter(({ pathIds }) => pathIds.includes(blockId))
    .map(({ branch, pathIds }) => ({
      name: branch.name,
      headBlockId: branch.headBlockId,
      nextBlockId: pathIds[pathIds.indexOf(blockId) + 1] ?? null,
      isActive: branch.name === session.activeBranch,
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
