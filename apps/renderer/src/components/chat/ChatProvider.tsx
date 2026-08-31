import { type PropsWithChildren, useCallback, useMemo } from 'react'
import { ChatContext, ChatRunningContext, type ChatContextType } from '@/hooks/useChatContext'
import { useSessionRunning, useSessionStoreActions } from '../../store/sessionStore'

export function ChatProvider({ sessionId, children }: PropsWithChildren<{ sessionId: string }>) {
  const running = useSessionRunning(sessionId)
  const { regenerateWorkflow } = useSessionStoreActions()

  // workflow 事件由全局 useAgentSessionEvent 统一分发到 session store，
  // 这里只是 fire-and-forget 触发主进程，不再自己开 stream / 监听 ipc
  const handleSend = useCallback(
    (input: string) => {
      window.ipcRendererApi.invoke('agent-session-send', {
        sessionId,
        input,
        inputSource: 'desktop',
      })
      return
    },
    [sessionId]
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
      window.ipcRendererApi.invoke('agent-session-send', {
        sessionId,
        input,
        inputSource: 'desktop',
      })
    },
    [regenerateWorkflow, sessionId]
  )

  const value: ChatContextType = useMemo(
    () => ({
      handleSend,
      handleStop,
      handleRegenerate,
      sessionId,
    }),
    [handleSend, handleStop, handleRegenerate, sessionId]
  )

  return (
    <ChatRunningContext.Provider value={running}>
      <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
    </ChatRunningContext.Provider>
  )
}
