import { createContext, useContext, type PropsWithChildren, useCallback, useMemo } from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { useSession, useSessionRuntime, useSessionStoreActions } from '../../store/sessionStore'

interface ChatContextType {
  handleSend: (input: string) => Promise<void>
  handleFork: (targetBlockId: string, branchName: string) => void
  running: boolean
  sessionId: string
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ sessionId, children }: PropsWithChildren<{ sessionId: string }>) {
  const { send } = useWorkflowStream()
  const session = useSession(sessionId)
  const sessionRuntime = useSessionRuntime(sessionId)
  const { forkSession } = useSessionStoreActions()

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
    async (targetBlockId: string, nextBranchName: string) => {
      await window.ipcRendererApi.invoke('agent-session-fork', {
        targetBlockId,
        branchName: nextBranchName,
      })
      forkSession({ sessionId, sourceWorkflowId: targetBlockId, branchName: nextBranchName })
    },
    [forkSession, sessionId]
  )

  const value: ChatContextType = useMemo(
    () => ({
      running: !!sessionRuntime?.running,
      handleSend,
      handleFork,
      sessionId,
    }),
    [handleFork, handleSend, sessionId, sessionRuntime]
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
