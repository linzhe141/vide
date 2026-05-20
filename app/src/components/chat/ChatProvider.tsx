import { createContext, useContext, type PropsWithChildren, useCallback, useMemo } from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { useSession, useSessionRuntime, useSessionStoreActions } from '../../store/sessionStore'

interface ChatContextType {
  handleSend: (input: string) => Promise<void>
  handleFork: (targetWorkflowId: string, branchName: string) => void
  handleRegenerate: (regenerateWorkflowId: string, branchName: string, input: string) => void
  running: boolean
  sessionId: string
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ sessionId, children }: PropsWithChildren<{ sessionId: string }>) {
  const { send } = useWorkflowStream()
  const session = useSession(sessionId)
  const sessionRuntime = useSessionRuntime(sessionId)
  const { forkSession, regenerateWorkflow } = useSessionStoreActions()

  const handleSend = useCallback(
    async (input: string) => {
      if (sessionRuntime?.running) return
      await send(input, {
        sessionId: sessionId,
        branchName: session?.activeBranch,
      })
    },
    [send, session?.activeBranch, sessionId, sessionRuntime]
  )

  const handleFork = useCallback(
    async (targetWorkflowId: string, nextBranchName: string) => {
      await window.ipcRendererApi.invoke('agent-session-fork', {
        targetWorkflowId,
        branchName: nextBranchName,
      })
      forkSession({ sessionId, sourceWorkflowId: targetWorkflowId, branchName: nextBranchName })
    },
    [forkSession, sessionId]
  )

  const handleRegenerate = useCallback(
    async (regenerateWorkflowId: string, branchName: string, input: string) => {
      await window.ipcRendererApi.invoke('agent-workflow-regenerate', {
        targetWorkflowId: regenerateWorkflowId,
        branchName,
      })
      regenerateWorkflow({ sessionId, sourceWorkflowId: regenerateWorkflowId, branchName })
      await send(input, {
        sessionId: sessionId,
        branchName: session?.activeBranch,
      })
    },
    [regenerateWorkflow, send, session?.activeBranch, sessionId]
  )

  const value: ChatContextType = useMemo(
    () => ({
      running: !!sessionRuntime?.running,
      handleSend,
      handleFork,
      handleRegenerate,
      sessionId,
    }),
    [handleFork, handleSend, handleRegenerate, sessionId, sessionRuntime]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}
