import { createContext, useContext, type PropsWithChildren, useCallback, useMemo } from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { useSession, useSessionRuntime, useSessionStoreActions } from '../../store/sessionStore'

interface ChatContextType {
  handleSend: (input: string, options?: { autoApprove?: boolean }) => Promise<void>
  handleFork: (targetWorkflowId: string) => Promise<string>
  handleRegenerate: (regenerateWorkflowId: string, branchName: string, input: string) => void
  handleAbort: () => Promise<void>
  running: boolean
  sessionId: string
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ sessionId, children }: PropsWithChildren<{ sessionId: string }>) {
  const { send, abort } = useWorkflowStream()
  const session = useSession(sessionId)
  const sessionRuntime = useSessionRuntime(sessionId)
  const { regenerateWorkflow } = useSessionStoreActions()

  const handleSend = useCallback(
    async (input: string, options?: { autoApprove?: boolean }) => {
      if (sessionRuntime?.running) return
      await send(input, {
        sessionId: sessionId,
        branchName: session?.activeBranch,
        autoApprove: options?.autoApprove,
      })
    },
    [send, session?.activeBranch, sessionId, sessionRuntime]
  )

  const handleFork = useCallback(
    async (targetWorkflowId: string) => {
      const nextSession = await window.ipcRendererApi.invoke('agent-session-fork', {
        sessionId,
        targetWorkflowId,
      })
      return nextSession.sessionId
    },
    [sessionId]
  )

  const handleRegenerate = useCallback(
    async (regenerateWorkflowId: string, branchName: string, input: string) => {
      await window.ipcRendererApi.invoke('agent-workflow-regenerate', {
        sessionId,
        targetWorkflowId: regenerateWorkflowId,
        branchName,
      })
      regenerateWorkflow({ sessionId, sourceWorkflowId: regenerateWorkflowId, branchName })
      await send(input, {
        sessionId: sessionId,
        branchName,
      })
    },
    [regenerateWorkflow, send, sessionId]
  )

  const value: ChatContextType = useMemo(
    () => ({
      running: !!sessionRuntime?.running,
      handleSend,
      handleFork,
      handleRegenerate,
      handleAbort: abort,
      sessionId,
    }),
    [abort, handleFork, handleSend, handleRegenerate, sessionId, sessionRuntime]
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
