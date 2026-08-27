import { useMemo } from 'react'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ToolCall } from '@vide/ai'
import type { SessionSource } from '@vide/config'
import type { WorkflowState } from '../../hooks/useAgentSessionEvent'
import { handleWorkflowEvent } from './eventHandlers/handleWorkflowEvent'
import { buildSessionFromData } from './buildSession'
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

function findSession(sessions: Session[], sessionId: string) {
  return sessions.find((item) => item.sessionId === sessionId)
}

function findActiveBranch(session: Session | undefined) {
  if (!session) return null
  return session.branches.find((item) => item.name === session.activeBranch) ?? null
}

function buildWorkflowChain(workflowNodesMap: Session['workflowNodesMap'], headWorkflowId: string) {
  const chain: string[] = []
  let currentWorkflowId: string | undefined = headWorkflowId
  const visited = new Set<string>()

  while (currentWorkflowId) {
    if (visited.has(currentWorkflowId)) {
      debugger
      throw new Error(`Cycle detected: ${currentWorkflowId}`)
    }

    visited.add(currentWorkflowId)

    const currentNode = workflowNodesMap[currentWorkflowId]
    if (!currentNode) {
      debugger
      throw new Error(`Node not found: ${currentWorkflowId}`)
    }

    chain.push(currentWorkflowId)
    currentWorkflowId = currentNode.parent ?? undefined
  }

  return chain
}

function buildWorkflowPath(
  workflowNodesMap: Session['workflowNodesMap'],
  headWorkflowId: string,
  stopAtWorkflowId: string | null
) {
  const path: string[] = []
  let currentWorkflowId: string | null = headWorkflowId

  while (currentWorkflowId) {
    path.unshift(currentWorkflowId)

    const currentNode = workflowNodesMap[currentWorkflowId]
    if (!currentNode) {
      debugger
      throw new Error(`Node not found: ${currentWorkflowId}`)
    }

    if (stopAtWorkflowId && currentNode.workflow.id === stopAtWorkflowId) {
      break
    }

    if (!currentNode.parent) {
      break
    }

    currentWorkflowId = currentNode.parent
  }

  return path
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
        const [data, runningWorkflows] = await Promise.all([
          window.ipcRendererApi.invoke('agent-resume-session', { sessionId }),
          window.ipcRendererApi.invoke('resume-running-workflow', { sessionId }),
        ])
        if (!data) return

        const derived = buildSessionFromData(data)
        set((state) => {
          const existingIndex = state.sessions.findIndex((item) => item.sessionId === sessionId)
          if (existingIndex >= 0) {
            state.sessions[existingIndex] = derived
          } else {
            state.sessions.push(derived)
          }
        })

        if (!runningWorkflows.length) return

        set((state) => {
          for (const runningWorkflow of runningWorkflows) {
            for (const event of runningWorkflow.recordedEvents) {
              handleWorkflowEvent(state, event)
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
  useSessionStore((state) => findSession(state.sessions, sessionId))

export const useHasSession = (sessionId: string) =>
  useSessionStore((state) => findSession(state.sessions, sessionId) != null)

export const useSessionWorkspacePath = (sessionId: string) =>
  useSessionStore((state) => findSession(state.sessions, sessionId)?.workspacePath)

export const useSessionAutoApprove = (sessionId: string) =>
  useSessionStore((state) => findSession(state.sessions, sessionId)?.autoApprove)

export const useSessionThinkingMode = (sessionId: string) =>
  useSessionStore((state) => findSession(state.sessions, sessionId)?.thinkingMode)

export const useSessionRunning = (sessionId: string) =>
  useSessionStore((state) => findSession(state.sessions, sessionId)?.runtime.running ?? false)

export const useSessionWorkflows = (sessionId: string) => {
  const workflowNodesMap = useSessionStore(
    (state) => findSession(state.sessions, sessionId)?.workflowNodesMap
  )
  const headWorkflowId = useSessionStore(
    (state) => findActiveBranch(findSession(state.sessions, sessionId))?.headWorkflowId ?? null
  )

  return useMemo(() => {
    if (!workflowNodesMap || !headWorkflowId) return undefined

    return buildWorkflowChain(workflowNodesMap, headWorkflowId)
      .reverse()
      .map((workflowId) => workflowNodesMap[workflowId]!.workflow)
  }, [headWorkflowId, workflowNodesMap])
}

export const useWorkflowBranches = (sessionId: string, workflowId: string | null) => {
  const branches = useSessionStore((state) => findSession(state.sessions, sessionId)?.branches)
  const workflowNodesMap = useSessionStore(
    (state) => findSession(state.sessions, sessionId)?.workflowNodesMap
  )

  return useMemo(() => {
    if (!branches || !workflowNodesMap) return []

    const branchPath = branches.map((branch) => ({
      path: branch.headWorkflowId
        ? buildWorkflowPath(workflowNodesMap, branch.headWorkflowId, branch.sourceWorkflowId)
        : [],
      branchName: branch.name,
    }))

    if (!workflowId) {
      return branches
        .filter((branch) => branch.sourceWorkflowId === null)
        .map((branch) => ({
          path: branchPath.find((item) => item.branchName === branch.name)?.path || [],
          ...branch,
        }))
    }

    const targetBranches = branchPath
      .filter((item) => item.path.includes(workflowId))
      .map((item) => item.branchName)

    return branches
      .filter((branch) => targetBranches.includes(branch.name))
      .map((branch) => ({
        path: branchPath.find((item) => item.branchName === branch.name)?.path || [],
        ...branch,
      }))
  }, [branches, workflowId, workflowNodesMap])
}

export const useActiveBranchPath = (sessionId: string) => {
  const activeBranch = useSessionStore((state) =>
    findActiveBranch(findSession(state.sessions, sessionId))
  )
  const workflowNodesMap = useSessionStore(
    (state) => findSession(state.sessions, sessionId)?.workflowNodesMap
  )

  return useMemo(() => {
    if (!activeBranch?.headWorkflowId || !workflowNodesMap) return []

    return buildWorkflowPath(
      workflowNodesMap,
      activeBranch.headWorkflowId,
      activeBranch.sourceWorkflowId
    )
  }, [activeBranch, workflowNodesMap])
}

export const useSessionRuntime = (sessionId: string) =>
  useSessionStore((state) => findSession(state.sessions, sessionId)?.runtime)

export const useHasPendingAskQuestion = (sessionId: string) => {
  const headWorkflowMessages = useSessionStore((state) => {
    const session = findSession(state.sessions, sessionId)
    const headWorkflowId = findActiveBranch(session)?.headWorkflowId
    if (!session || !headWorkflowId) return undefined
    return session.workflowNodesMap[headWorkflowId]?.workflow.messages
  })

  return useMemo(() => {
    if (!headWorkflowMessages) return false

    const latestMessage = [...headWorkflowMessages]
      .reverse()
      .find((message) => message.role !== 'workflow')

    // ask-question 属于某个 workflow，提交答案会产生下一个 workflow（子节点）。
    // head workflow 是 active branch 最新的 workflow，后面不会有子节点，
    // 因此 head 若以 ask-question 结尾 → 该问题尚未提交 → 隐藏下方 ChatInput（不能两个输入入口）。
    return latestMessage?.role === 'ask-user-question'
  }, [headWorkflowMessages])
}

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
): Workflow | undefined => {
  const workflowNodesMap = useSessionStore(
    (state) => findSession(state.sessions, sessionId)?.workflowNodesMap
  )
  const headWorkflowId = useSessionStore(
    (state) => findActiveBranch(findSession(state.sessions, sessionId))?.headWorkflowId ?? null
  )

  return useMemo(() => {
    if (!workflowNodesMap || !workflowId || !headWorkflowId) return undefined

    const chain = buildWorkflowChain(workflowNodesMap, headWorkflowId)
    const selfIndex = chain.indexOf(workflowId)
    const nextId = selfIndex > 0 ? chain[selfIndex - 1] : undefined
    if (!nextId) return undefined
    return workflowNodesMap[nextId]?.workflow
  }, [headWorkflowId, workflowId, workflowNodesMap])
}
