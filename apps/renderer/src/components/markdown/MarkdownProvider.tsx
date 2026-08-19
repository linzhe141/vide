import { useMemo, type PropsWithChildren } from 'react'
import { MarkdownContext } from '@/hooks/useMarkdown'

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
