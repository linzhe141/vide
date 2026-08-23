import { createContext, useContext } from 'react'

export interface ChatContextType {
  handleSend: (input: string) => void
  handleStop: () => void
  handleRegenerate: (regenerateWorkflowId: string, branchName: string, input: string) => void
  running: boolean
  sessionId: string
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}
