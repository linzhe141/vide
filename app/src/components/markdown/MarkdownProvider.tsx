import { createContext, useContext, type PropsWithChildren } from 'react'

interface MarkdownContextValue {
  animation: boolean
}

const MarkdownContext = createContext<MarkdownContextValue | undefined>(undefined)

export const useMarkdown = () => {
  const context = useContext(MarkdownContext)
  if (!context) {
    throw new Error('useMarkdown must be used within MarkdownProvider')
  }
  return context
}

export const MarkdownProvider = ({
  children,
  value,
}: PropsWithChildren<{ value: MarkdownContextValue }>) => {
  return <MarkdownContext.Provider value={value}>{children}</MarkdownContext.Provider>
}
