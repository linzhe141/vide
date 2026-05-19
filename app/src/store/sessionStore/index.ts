import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { WorkflowState } from '../../hooks/createWorkflowStream'
import { handleWorkflowEvent } from './eventHandlers/handleWorkflowEvent'
import type { ConversationBlock, Session, SessionBranch } from './types'

type TreeNode = {
  workflowNode: ConversationBlock
  children: TreeNode[]
  parent: string | null
}
type SessionState = {
  sessions: Session[]
  // for debug
  sessionWorkflowTree: TreeNode | null
}
type SessionActions = {
  actions: {
    handleEvent: (event: WorkflowState) => void
    buildFromDatabase: (data: Session) => void
    updateAskUserSubmitValue: (
      sessionId: string,
      blockId: string,
      messageId: string,
      value: string[]
    ) => void
    switchBranch: (sessionId: string, branchName: string) => void
    createSession: (data: { sessionId: string }) => void
    forkSession: (data: { sessionId: string; sourceWorkflowId: string; branchName: string }) => void
    // for debugger
    buildSessionWorkflowTree: (sessionId: string) => any
  }
}

export const useSessionStore = create<SessionState & SessionActions>()(
  immer((set) => ({
    sessions: [],
    sessionWorkflowTree: null,
    //
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
      updateAskUserSubmitValue(sessionId, blockId, messageId, value) {
        set((state) => {
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const blockNode = session.blockNodesMap[blockId]
          if (!blockNode) return
          const message = blockNode.workflowNode.messages.find((item) => item.id === messageId)
          if (!message || message.role !== 'ask-user') return
          message.submitValue = value
        })
      },
      switchBranch(sessionId, branchName) {
        set((state) => {
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const targetBranch = session.branches.find((item) => item.name === branchName)
          if (!targetBranch) return
          session.activeBranch = branchName
        })
      },
      createSession({ sessionId }) {
        set((state) => {
          const activeBranch = 'main'
          const newSession: Session = {
            sessionId,
            activeBranch,
            branches: [
              {
                name: activeBranch,
                headBlockId: null,
                // main 分支的 sourceBlockId 永远为 null，因为 main 分支是从无到有创建的
                sourceBlockId: null,
              },
            ],
            blockNodesMap: {},
            runtime: {
              running: false,
            },
            planner: [],
            artifacts: [],
          }
          state.sessions.push(newSession)
        })
      },
      forkSession({ sessionId, sourceWorkflowId, branchName }) {
        // forked === create branch and switch to it, do not commit node

        // a-> b(main)
        //     b(forked)

        // after commit
        // a-> b(main) -> c
        //     b(forked) - > d
        //  a-> b -> c:main
        //       \-> d:forked
        set((state) => {
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const newBranch: SessionBranch = {
            name: branchName,
            headBlockId: sourceWorkflowId,
            sourceBlockId: sourceWorkflowId,
          }
          session.branches.push(newBranch)
          session.activeBranch = branchName
        })
      },
      // for debugger
      buildSessionWorkflowTree(sessionId: string) {
        set((state) => {
          const session = state.sessions.find((s) => s.sessionId === sessionId)
          if (!session) return

          const blockNodesMap = session.blockNodesMap

          function buildNode(id: string): TreeNode {
            const node = blockNodesMap[id]
            return {
              workflowNode: node.workflowNode,
              children: node.children.map((childId) => buildNode(childId)),
              parent: node.parent ?? null,
            }
          }

          const rootId = Object.values(blockNodesMap).find((n) => !n.parent)?.workflowNode.id
          if (!rootId) {
            state.sessionWorkflowTree = null
            return
          }

          state.sessionWorkflowTree = buildNode(rootId)
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
  if (!activeBranch || !activeBranch.headBlockId) return undefined

  function traverse(nodeId: string, result: ConversationBlock[] = []) {
    const node = session!.blockNodesMap[nodeId]
    result.unshift(node.workflowNode)
    if (node.parent) {
      traverse(node.parent, result)
    }
    return result
  }

  return traverse(activeBranch.headBlockId)
}

export const useBlockBranches = (sessionId: string, blockId: string) => {
  const session = useSession(sessionId)
  if (!session) return []

  const branchPath: { path: string[]; branchName: string }[] = []

  for (const branch of session.branches) {
    const path: string[] = []
    let currentBlockId = branch.headBlockId

    while (currentBlockId) {
      path.unshift(currentBlockId) // 从头部插入，保持从上到下的顺序

      const currentNode = session.blockNodesMap[currentBlockId]

      // 如果当前节点是 sourceBlockId，停止收集（不包含 sourceBlockId 本身）
      if (branch.sourceBlockId && currentNode.workflowNode.id === branch.sourceBlockId) {
        break
      }

      // 继续向上遍历父节点
      if (currentNode.parent) {
        currentBlockId = currentNode.parent
      } else {
        break
      }
    }
    branchPath.push({ path, branchName: branch.name })
  }
  const result: { branchName: string }[] = []
  for (const { path, branchName } of branchPath) {
    if (path.includes(blockId)) {
      result.push({ branchName })
    }
  }
  return result
}

export const useSessionPlanners = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId)?.planner)

export const useSessionRuntime = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId)?.runtime)
