import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ToolCall } from '@vide/ai'
import type { SessionSource } from '@vide/config'
import type { WorkflowState } from '../../hooks/useAgentSessionEvent'
import { handleWorkflowEvent } from './eventHandlers/handleWorkflowEvent'
import { deriveSessionFromData } from './deriveSession'
import type { AskUserQuestionSessionMessage, Workflow, Session, SessionBranch } from './types'

type SessionState = {
  sessions: Session[]
}

type ChangeToolCallStatusData = {
  sessionId: string
  workflowId: string
  toolCallId: string
  newStatus: ToolCall['status']
}

type UpdateAskQuestionAnswerData = {
  sessionId: string
  workflowId: string
  messageId: string
  questionId: string
  answer: AskUserQuestionSessionMessage['questions'][number]['answer']
}

type SessionActions = {
  actions: {
    handleEvent: (event: WorkflowState) => void
    changeToolCallStatus: (data: ChangeToolCallStatusData) => void
    updateAskQuestionAnswer: (data: UpdateAskQuestionAnswerData) => void

    clearSessions: () => void

    /** 从 SQLite 加载一个已持久化的 session，并派生其 UI 态（workflow/message/log）。 */
    loadSession: (sessionId: string) => Promise<void>

    switchBranch: (sessionId: string, branchName: string) => void
    createSession: (data: {
      sessionId: string
      sessionSource?: SessionSource
      workspacePath?: string | null
      autoApprove?: boolean
      thinkingMode?: boolean
    }) => void
    switchSessionAutoApprove: (sessionId: string, newValue: boolean) => void
    switchSessionThinkingMode: (sessionId: string, newValue: boolean) => void
    regenerateWorkflow: (data: {
      sessionId: string
      sourceWorkflowId: string
      branchName: string
    }) => void
    changeWorkflowInput: (data: { sessionId: string; workflowId: string; newInput: string }) => void
    setWorkflowFeedback: (data: {
      sessionId: string
      workflowId: string
      feedback: Workflow['feedback']
    }) => void
  }
}

export const useSessionStore = create<SessionState & SessionActions>()(
  immer((set) => ({
    sessions: [],
    //
    actions: {
      handleEvent(event) {
        set((state) => {
          handleWorkflowEvent(state, event)
        })
      },
      changeToolCallStatus(data: ChangeToolCallStatusData) {
        set((state) => {
          const { sessionId, workflowId, toolCallId, newStatus } = data
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const workflowNode = session.workflowNodesMap[workflowId]
          if (!workflowNode) return
          const toolCallMessage = workflowNode.workflow.messages
            .filter((item) => item.role === 'tool-call')
            .map((i) => i.toolCalls.map((call) => call.toolCall))
            .flat()
          if (!toolCallMessage.length) return
          const targetToolCall = toolCallMessage.find((t) => t.id === toolCallId)
          if (!targetToolCall) return
          targetToolCall.status = newStatus
        })
      },
      updateAskQuestionAnswer(data: UpdateAskQuestionAnswerData) {
        set((state) => {
          const { sessionId, workflowId, messageId, questionId, answer } = data
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const workflowNode = session.workflowNodesMap[workflowId]
          if (!workflowNode) return
          const targetMessage = workflowNode.workflow.messages.find(
            (message) => message.role === 'ask-user-question' && message.id === messageId
          )
          if (!targetMessage || targetMessage.role !== 'ask-user-question') return
          const targetQuestion = targetMessage.questions.find(
            (question) => question.id === questionId
          )
          if (!targetQuestion) return
          targetQuestion.answer = answer
        })
      },
      clearSessions() {
        set((state) => {
          state.sessions = []
        })
      },
      async loadSession(sessionId) {
        const data = await window.ipcRendererApi.invoke('agent-resume-session', { sessionId })
        if (!data) return
        const derived = deriveSessionFromData(data)
        set((state) => {
          const existingIndex = state.sessions.findIndex((item) => item.sessionId === sessionId)
          if (existingIndex >= 0) {
            state.sessions[existingIndex] = derived
          } else {
            state.sessions.push(derived)
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
        })
      },
      changeWorkflowInput(data) {
        set((state) => {
          const { sessionId, workflowId, newInput } = data
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const workflowNode = session.workflowNodesMap[workflowId]
          if (!workflowNode) return
          workflowNode.workflow.input = newInput
        })
      },
      setWorkflowFeedback(data) {
        set((state) => {
          const { sessionId, workflowId, feedback } = data
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          const workflowNode = session.workflowNodesMap[workflowId]
          if (!workflowNode) return
          workflowNode.workflow.feedback = feedback
        })
      },
      createSession({
        sessionId,
        sessionSource = 'desktop',
        workspacePath = null,
        autoApprove = false,
        thinkingMode = false,
      }) {
        set((state) => {
          const activeBranch = 'main'
          const newSession: Session = {
            sessionId,
            sessionSource,
            autoApprove,
            workspacePath,
            thinkingMode,
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
          }
          const existingIndex = state.sessions.findIndex((item) => item.sessionId === sessionId)
          if (existingIndex >= 0) {
            state.sessions[existingIndex] = newSession
            return
          }
          state.sessions.push(newSession)
        })
      },
      switchSessionAutoApprove(sessionId, newValue) {
        set((state) => {
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          session.autoApprove = newValue
        })
      },
      switchSessionThinkingMode(sessionId, newValue) {
        set((state) => {
          const session = state.sessions.find((item) => item.sessionId === sessionId)
          if (!session) return
          session.thinkingMode = newValue
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

  // function traverse(nodeId: string, result: Workflow[] = []) {
  //   const node = session!.workflowNodesMap[nodeId]
  //   if (node == null) {
  //     debugger
  //   }
  //   result.unshift(node.workflow)
  //   if (node.parent) {
  //     traverse(node.parent, result)
  //   }
  //   return result
  // }
  function traverse(nodeId: string, result: Workflow[] = [], visited = new Set<string>()) {
    if (visited.has(nodeId)) {
      debugger // 找到环了
      throw new Error(`Cycle detected: ${nodeId}`)
    }

    visited.add(nodeId)

    const node = session!.workflowNodesMap[nodeId]

    if (!node) {
      debugger
      throw new Error(`Node not found: ${nodeId}`)
    }

    result.unshift(node.workflow)

    if (node.parent) {
      traverse(node.parent, result, visited)
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

export const useSessionRuntime = (sessionId: string) =>
  useSessionStore((state) => state.sessions.find((item) => item.sessionId === sessionId)?.runtime)

export const useHasPendingAskQuestion = (sessionId: string) =>
  useSessionStore((state) => {
    const session = state.sessions.find((item) => item.sessionId === sessionId)
    if (!session) return false

    const activeBranch = session.branches.find((item) => item.name === session.activeBranch)
    if (!activeBranch?.headWorkflowId) return false

    const headWorkflowNode = session.workflowNodesMap[activeBranch.headWorkflowId]
    if (!headWorkflowNode) return false

    const latestMessage = [...headWorkflowNode.workflow.messages]
      .reverse()
      .find((message) => message.role !== 'workflow')

    // ask-question 属于某个 workflow，提交答案会产生下一个 workflow（子节点）。
    // head workflow 是 active branch 最新的 workflow，后面不会有子节点，
    // 因此 head 若以 ask-question 结尾 → 该问题尚未提交 → 隐藏下方 ChatInput（不能两个输入入口）。
    return latestMessage?.role === 'ask-user-question'
  })

/**
 * 取 active branch 上、紧跟在 `workflowId` 之后的「下一个 workflow」（子节点）。
 *
 * ask-question 属于某个 workflow，用户提交答案必然产生下一个 workflow（子节点）；
 * 因此「该 workflow 后面还有 workflow」= 已回答。此处直接从活动分支的 head 往回
 * 收集线性链再定位子节点，纯图遍历、与数组顺序无关。
 *
 * 返回 undefined 表示该 workflow 是活动分支的最新（head）节点，没有子节点。
 */
export const useSessionWorkflowNext = (
  sessionId: string,
  workflowId: string
): Workflow | undefined =>
  useSessionStore((state) => {
    const session = state.sessions.find((item) => item.sessionId === sessionId)
    if (!session || !workflowId) return undefined

    const activeBranch = session.branches.find((item) => item.name === session.activeBranch)
    if (!activeBranch?.headWorkflowId) return undefined

    // 从 head 往回沿 parent 收集线性链：chain[0]=head(最新) ... chain[last]=root(最旧)。
    // 某节点的子节点在链上更靠近 head，即出现在更小 index。
    const chain: string[] = []
    let currentId: string | undefined = activeBranch.headWorkflowId
    const visited = new Set<string>()
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      chain.push(currentId)
      currentId = session.workflowNodesMap[currentId]?.parent ?? undefined
    }

    const selfIndex = chain.indexOf(workflowId)
    // selfIndex===0 表示该 workflow 就是 head，其后无节点。
    const nextId = selfIndex > 0 ? chain[selfIndex - 1] : undefined
    if (!nextId) return undefined
    return session.workflowNodesMap[nextId]?.workflow
  })
