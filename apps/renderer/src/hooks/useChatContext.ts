import { createContext, useContext } from 'react'

export interface ChatContextType {
  handleSend: (input: string) => void
  handleStop: () => void
  handleRegenerate: (regenerateWorkflowId: string, branchName: string, input: string) => void
  sessionId: string
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined)
export const ChatRunningContext = createContext<boolean | undefined>(undefined)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}

export function useChatRunning() {
  const running = useContext(ChatRunningContext)
  if (running === undefined) {
    throw new Error('useChatRunning must be used within ChatProvider')
  }
  return running
}
