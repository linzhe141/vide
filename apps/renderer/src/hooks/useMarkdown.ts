import { createContext, useContext } from 'react'

export interface MarkdownContextValue {
  animation: boolean
  onCitationClick?: () => void
}

export const MarkdownContext = createContext<MarkdownContextValue | undefined>(undefined)

export function useMarkdown() {
  const context = useContext(MarkdownContext)
  if (!context) {
    throw new Error('useMarkdown must be used within MarkdownProvider')
  }
  return context
}
