import {
  createContext,
  useContext,
  useState,
  useEffect,
  type PropsWithChildren,
  useCallback,
} from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import { context } from '../../hooks/chatContenxt'

interface ChatContextType {
  // State
  approvedToolCalls: Set<string>

  // From useWorkflowStream
  send: (message: string) => Promise<void>
  isFinished: boolean
  isRunning: boolean
  isError: boolean
  errorInfo: any

  // Actions
  handleSend: (input: string) => Promise<void>
  handleApprove: (id: string) => void
  handleReject: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: PropsWithChildren) {
  const { send, isFinished, isRunning, isError, errorInfo } = useWorkflowStream()
  const [approvedToolCalls, setApprovedCalls] = useState<Set<string>>(new Set())

  useEffect(() => {
    const firstInput = context.firstInput
    if (firstInput) {
      console.log('firstInput', firstInput)
      context.firstInput = ''
      send(firstInput)
    }
  }, [send])

  const handleSend = useCallback(
    async (input: string) => {
      await send(input)
    },
    [send]
  )

  const handleApprove = useCallback((id: string) => {
    setApprovedCalls((prev) => new Set(prev).add(id))
    window.ipcRendererApi.invoke('agent-human-approved')
  }, [])

  const handleReject = useCallback(() => {}, [])

  const value: ChatContextType = {
    approvedToolCalls,
    send,
    isFinished,
    isRunning,
    isError,
    errorInfo,
    handleSend,
    handleApprove,
    handleReject,
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
