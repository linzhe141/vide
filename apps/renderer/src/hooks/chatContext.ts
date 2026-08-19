import { createContext } from 'react'

export interface ChatContextType {
  handleSend: (input: string) => void
  handleStop: () => void
  handleRegenerate: (regenerateWorkflowId: string, branchName: string, input: string) => void
  running: boolean
  sessionId: string
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined)
