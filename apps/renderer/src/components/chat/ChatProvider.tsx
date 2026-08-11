import { createContext, useContext, type PropsWithChildren, useCallback, useMemo } from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { useSessionRuntime, useSessionStoreActions } from '../../store/sessionStore'

interface ChatContextType {
  handleSend: (input: string) => Promise<void>
  handleRegenerate: (regenerateWorkflowId: string, branchName: string, input: string) => void
  running: boolean
  sessionId: string
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ sessionId, children }: PropsWithChildren<{ sessionId: string }>) {
  const { send } = useWorkflowStream()
  const sessionRuntime = useSessionRuntime(sessionId)!
  const { regenerateWorkflow } = useSessionStoreActions()

  const handleSend = useCallback(
    async (input: string) => {
      if (sessionRuntime.running) return
      await send(sessionId, input)
    },
    [send, sessionId, sessionRuntime]
  )

  const handleRegenerate = useCallback(
    async (regenerateWorkflowId: string, branchName: string, input: string) => {
      await window.ipcRendererApi.invoke('agent-workflow-regenerate', {
        sessionId,
        targetWorkflowId: regenerateWorkflowId,
        branchName,
      })
      regenerateWorkflow({ sessionId, sourceWorkflowId: regenerateWorkflowId, branchName })
      await send(sessionId, input)
    },
    [regenerateWorkflow, send, sessionId]
  )

  const value: ChatContextType = useMemo(
    () => ({
      running: !!sessionRuntime?.running,
      handleSend,
      handleRegenerate,
      sessionId,
    }),
    [handleSend, handleRegenerate, sessionId, sessionRuntime]
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
