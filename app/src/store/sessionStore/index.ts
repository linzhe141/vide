import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { WorkflowState } from '../../hooks/createWorkflowStream'
import { handleAgentEvent } from './eventHandlers/handleAgentEvent'
import type { BlockNode, ConversationBlock, Session, SessionBranch } from './types'

type SessionState = {
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

export const sessionBlocksMap = new Map<
  string,
  {
    [blockId: string]: ConversationBlock
  }
>()

export const sessionBlockNodeMap = new Map<
  string,
  {
    [blockId: string]: BlockNode
  }
>()

export const useSessionStore = create<SessionState & SessionActions>()(
  immer((set) => ({
    sessions: [],
    actions: {
      handleEvent(event) {
        set((state) => {
          handleAgentEvent(state, event)
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
          // for (const session of state.sessions) {
          //   for (const blockId of session.blockOrder) {
          //     const block = session.blockMap[blockId]
          //     if (!block) continue
          //     const msg = block.messages.find((message) => message.id === id)
          //     if (msg && msg.role === 'ask-user') {
          //       msg.submitValue = value
          //       return
          //     }
          //   }
          // }
        })
      },
      switchBranch(sessionId, branchName) {
        set((state) => {
          // const session = state.sessions.find((item) => item.sessionId === sessionId)
          // if (!session) return
          // const targetBranch = session.branches.find((item) => item.name === branchName)
          // if (!targetBranch) return
          // session.activeBranch = branchName
          // session.currentBlockId = targetBranch.headBlockId || undefined
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

  const activeBranch = session.branches.find((item) => item.name === session.activeBranch)
  if (!activeBranch) return undefined

  function traverse(node: BlockNode, result: ConversationBlock[] = []): ConversationBlock[] {
    result.unshift(node.workflowNode)
    if (node.parent) {
      traverse(node.parent, result)
    }
    return result
  }

  return traverse(activeBranch.headBlock!)
}

export const useBlockBranches = (sessionId: string, blockId: string) => {
  const session = useSession(sessionId)
  if (!session) return []
  const targetBlockNode = sessionBlocksMap.get(session.sessionId)?.[blockId]
  if (!targetBlockNode) return []

  const branches: SessionBranch[] = []
  function traverse(node: BlockNode) {
    const branch = session.branches.find(
      (item) => item.headBlock?.workflowNode.id === node.workflowNode.id
    )
    if (branch) {
      branches.push(branch)
    }
    for (const child of node.children) {
      traverse(child)
    }
  }
  return branches
}

export const useSessionPlanners = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId)?.planner)

export const useSessionRunning = (sessionId: string) =>
  useSessionStore(
    (state) => state.sessions.find((item) => item.sessionId === sessionId)?.runtime.running
  )
