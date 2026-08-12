import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'

interface MarkdownContextValue {
  animation: boolean
  onCitationClick?: () => void
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
  animation,
  onCitationClick,
}: PropsWithChildren<{ animation: boolean; onCitationClick?: () => void }>) => {
  /**
   * ✅ 防止 context 触发子组件全部 render
   */
  const value = useMemo(() => ({ animation, onCitationClick }), [animation, onCitationClick])

  return <MarkdownContext.Provider value={value}>{children}</MarkdownContext.Provider>
}
