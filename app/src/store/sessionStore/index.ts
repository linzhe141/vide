import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { WorkflowState } from '../../hooks/createWorkflowStream'
import { handleWorkflowEvent } from './eventHandlers/handleWorkflowEvent'
import type { Workflow, Session, SessionBranch } from './types'

type TreeNode = {
  workflow: Workflow
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
      workflowId: string,
      messageId: string,
      value: string[]
    ) => void
    switchBranch: (sessionId: string, branchName: string) => void
    createSession: (data: { sessionId: string }) => void
    forkSession: (data: { sessionId: string; sourceWorkflowId: string; branchName: string }) => void
    regenerateWorkflow: (data: {
      sessionId: string
      sourceWorkflowId: string
      branchName: string
    }) => void
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
          state.sessions.push(data)
        })
      },
      updateAskUserSubmitValue(sessionId, workflowId, messageId, value) {
        set((state) => {
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const workflowNode = session.workflowNodesMap[workflowId]
          if (!workflowNode) return
          const message = workflowNode.workflow.messages.find((item) => item.id === messageId)
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
                headWorkflowId: null,
                // main 分支的 sourceWorkflowId 永远为 null，因为 main 分支是从无到有创建的
                sourceWorkflowId: null,
              },
            ],
            workflowNodesMap: {},
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
            headWorkflowId: sourceWorkflowId,
            sourceWorkflowId: sourceWorkflowId,
          }
          session.branches.push(newBranch)
          session.activeBranch = branchName
        })
      },
      regenerateWorkflow({ sessionId, sourceWorkflowId, branchName }) {
        set((state) => {
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const regenerateWorkflowNode = session.workflowNodesMap[sourceWorkflowId]
          if (!regenerateWorkflowNode) return
          const parentId = regenerateWorkflowNode.parent
          const newBranch: SessionBranch = {
            name: branchName,
            headWorkflowId: parentId,
            sourceWorkflowId: parentId,
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

          const workflowNodesMap = session.workflowNodesMap

          function buildNode(id: string): TreeNode {
            const node = workflowNodesMap[id]
            return {
              workflow: node.workflow,
              children: node.children.map((childId) => buildNode(childId)),
              parent: node.parent ?? null,
            }
          }

          const rootId = Object.values(workflowNodesMap).find((n) => !n.parent)?.workflow.id
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

export const useSessionWorkflows = (sessionId: string) => {
  const session = useSession(sessionId)
  if (!session) return undefined

  const activeBranch = session.branches.find((item) => item.name === session.activeBranch)
  if (!activeBranch || !activeBranch.headWorkflowId) return undefined

  function traverse(nodeId: string, result: Workflow[] = []) {
    const node = session!.workflowNodesMap[nodeId]
    result.unshift(node.workflow)
    if (node.parent) {
      traverse(node.parent, result)
    }
    return result
  }

  return traverse(activeBranch.headWorkflowId)
}

export const useWorkflowBranches = (sessionId: string, workflowId: string | null) => {
  const session = useSession(sessionId)
  if (!session) return []

  const branchPath: { path: string[]; branchName: string }[] = []

  for (const branch of session.branches) {
    const path: string[] = []
    let currentWorkflowId = branch.headWorkflowId

    while (currentWorkflowId) {
      path.unshift(currentWorkflowId) // 从头部插入，保持从上到下的顺序

      const currentNode = session.workflowNodesMap[currentWorkflowId]

      // 如果当前节点是 sourceWorkflowId，停止收集
      if (branch.sourceWorkflowId && currentNode.workflow.id === branch.sourceWorkflowId) {
        break
      }
      // 如果当前节点没有父节点了，停止收集
      if (!currentNode.parent) {
        break
      }
      // 继续向上遍历父节点
      currentWorkflowId = currentNode.parent
    }
    branchPath.push({ path, branchName: branch.name })
  }
  if (!workflowId) {
    // 收集所有的root 级别的 branch
    return session.branches
      .filter((i) => i.sourceWorkflowId === null)
      .map((i) => ({
        path: branchPath.find((b) => b.branchName === i.name)?.path || [],
        ...i,
      }))
  }
  const targetBranches: string[] = []
  for (const { path, branchName } of branchPath) {
    if (path.includes(workflowId)) {
      targetBranches.push(branchName)
    }
  }
  return session.branches
    .filter((branch) => targetBranches.includes(branch.name))
    .map((i) => ({
      path: branchPath.find((b) => b.branchName === i.name)?.path || [],
      ...i,
    }))
}

export const useActiveBranchPath = (sessionId: string) => {
  const session = useSession(sessionId)
  if (!session) return []

  const activeBranch = session.branches.find((item) => item.name === session.activeBranch)
  if (!activeBranch) return []

  const path: string[] = []
  let currentWorkflowId = activeBranch.headWorkflowId

  while (currentWorkflowId) {
    path.unshift(currentWorkflowId) // 从头部插入，保持从上到下的顺序

    const currentNode = session.workflowNodesMap[currentWorkflowId]

    // 如果当前节点是 sourceWorkflowId，停止收集
    if (
      activeBranch.sourceWorkflowId &&
      currentNode.workflow.id === activeBranch.sourceWorkflowId
    ) {
      break
    }
    // 如果当前节点没有父节点了，停止收集
    if (!currentNode.parent) {
      break
    }
    // 继续向上遍历父节点
    currentWorkflowId = currentNode.parent
  }
  return path
}

export const useSessionPlanners = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId)?.planner)

export const useSessionRuntime = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId)?.runtime)
