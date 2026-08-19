import { useContext } from 'react'
import { ChatLayoutContext } from './chatLayoutContext'

export function useChatLayout() {
  const context = useContext(ChatLayoutContext)
  if (!context) throw new Error('Must be used within ChatLayout')
  return context
}
