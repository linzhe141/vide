import { createContext, useContext, type PropsWithChildren, useCallback, useMemo } from 'react'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'

interface ChatContextType {
  // Actions
  handleSend: (input: string) => Promise<void>
  running: boolean
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: PropsWithChildren) {
  const { send, running } = useWorkflowStream()

  const handleSend = useCallback(
    async (input: string) => {
      await send(input)
    },
    [send]
  )

  const value: ChatContextType = useMemo(
    () => ({
      running,
      handleSend,
    }),
    [handleSend]
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
