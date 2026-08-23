import { createContext, useContext, type RefObject } from 'react'
import type { ChatPanelDefinition, ChatPanelId } from '@/layout/ChatLayout/panels'

export interface ChatLayoutScrollContextType {
  scrollContainerRef: RefObject<HTMLDivElement | null>
  scrollToBottom: () => void
}

export interface ChatLayoutContextType {
  isPaneOpen: boolean
  activePanelId: ChatPanelId | null
  activePanel: ChatPanelDefinition | null
  togglePane: (next: ChatPanelId) => void
  openPanel: (next: ChatPanelId) => void
  showWebSearchResults: () => void
  closePane: () => void
}

export const ChatLayoutScrollContext = createContext<ChatLayoutScrollContextType | null>(null)
export const ChatLayoutContext = createContext<ChatLayoutContextType | null>(null)

export function useChatLayoutScroll() {
  const context = useContext(ChatLayoutScrollContext)
  if (!context) throw new Error('Must be used within ChatLayoutScrollContext')
  return context
}

export function useChatLayout() {
  const context = useContext(ChatLayoutContext)
  if (!context) throw new Error('Must be used within ChatLayout')
  return context
}
