import { createContext } from 'react'

export interface MarkdownContextValue {
  animation: boolean
  onCitationClick?: () => void
}

export const MarkdownContext = createContext<MarkdownContextValue | undefined>(undefined)
