import { createContext, type RefObject } from 'react'
import type { ChatPanelDefinition, ChatPanelId } from '@/layout/ChatLayout/panels'

export interface ChatLayoutContextType {
  scrollContainerRef: RefObject<HTMLDivElement | null>
  scrollToBottom: () => void
  isPaneOpen: boolean
  activePanelId: ChatPanelId | null
  activePanel: ChatPanelDefinition | null
  togglePane: (next: ChatPanelId) => void
  openPanel: (next: ChatPanelId) => void
  showWebSearchResults: () => void
  closePane: () => void
}

export const ChatLayoutContext = createContext<ChatLayoutContextType | null>(null)
