import { createContext, useContext, type PropsWithChildren, useCallback, useMemo } from 'react'
import { useSessionRuntime, useSessionStoreActions } from '../../store/sessionStore'

interface ChatContextType {
  handleSend: (input: string) => void
  handleStop: () => void
  handleRegenerate: (regenerateWorkflowId: string, branchName: string, input: string) => void
  running: boolean
  sessionId: string
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ sessionId, children }: PropsWithChildren<{ sessionId: string }>) {
  const sessionRuntime = useSessionRuntime(sessionId)!
  const { regenerateWorkflow } = useSessionStoreActions()

  // workflow 事件由全局 useAgentSessionEvent 统一分发到 session store，
  // 这里只是 fire-and-forget 触发主进程，不再自己开 stream / 监听 ipc
  const handleSend = useCallback(
    (input: string) => {
      if (sessionRuntime.running) return
      window.ipcRendererApi.invoke('agent-session-send', { sessionId, input })
      return
    },
    [sessionId, sessionRuntime]
  )

  const handleStop = useCallback(() => {
    window.ipcRendererApi.invoke('agent-session-abort', { sessionId })
  }, [sessionId])

  const handleRegenerate = useCallback(
    async (regenerateWorkflowId: string, branchName: string, input: string) => {
      await window.ipcRendererApi.invoke('agent-workflow-regenerate', {
        sessionId,
        targetWorkflowId: regenerateWorkflowId,
        branchName,
      })
      regenerateWorkflow({ sessionId, sourceWorkflowId: regenerateWorkflowId, branchName })
      window.ipcRendererApi.invoke('agent-session-send', { sessionId, input })
    },
    [regenerateWorkflow, sessionId]
  )

  const value: ChatContextType = useMemo(
    () => ({
      running: !!sessionRuntime?.running,
      handleSend,
      handleStop,
      handleRegenerate,
      sessionId,
    }),
    [handleSend, handleStop, handleRegenerate, sessionId, sessionRuntime]
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
