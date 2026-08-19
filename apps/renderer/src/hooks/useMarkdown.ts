import { useContext } from 'react'
import { MarkdownContext } from './markdownContext'

export function useMarkdown() {
  const context = useContext(MarkdownContext)
  if (!context) {
    throw new Error('useMarkdown must be used within MarkdownProvider')
  }
  return context
}
