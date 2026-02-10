import { createContext, useContext, type PropsWithChildren, useCallback } from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { useThreadStore } from '../../store/threadStore'

interface ChatContextType {
  // From useWorkflowStream
  isFinished: boolean
  isRunning: boolean
  isError: boolean
  errorInfo: any

  // Actions
  handleSend: (input: string) => Promise<void>
  handleApprove: (toolCallId: string) => void
  handleReject: (toolCallId: string) => void
  abort: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: PropsWithChildren) {
  const { setToolCallStatus } = useThreadStore()
  const { send, isFinished, isRunning, isError, errorInfo, abort } = useWorkflowStream()

  const handleSend = useCallback(
    async (input: string) => {
      await send(input)
    },
    [send]
  )

  const handleApprove = useCallback(
    (toolCallId: string) => {
      window.ipcRendererApi.invoke('agent-human-approved')
      setToolCallStatus({ status: 'approve', toolCallId })
    },
    [setToolCallStatus]
  )

  const handleReject = useCallback(
    (toolCallId: string) => {
      window.ipcRendererApi.invoke('agent-human-rejected')
      setToolCallStatus({ status: 'reject', toolCallId })
    },
    [setToolCallStatus]
  )

  const value: ChatContextType = {
    isFinished,
    isRunning,
    isError,
    errorInfo,
    handleSend,
    handleApprove,
    handleReject,
    abort,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}
