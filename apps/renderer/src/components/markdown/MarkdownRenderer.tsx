import { memo } from 'react'
import { Streamdown } from 'streamdown'
import { cn } from '../../lib/utils'
import { MarkdownProvider } from './MarkdownProvider'
import { components } from './components'

type MarkdownRendererProps = {
  children?: string | null
  className?: string
  animation: boolean
  onCitationClick?: () => void
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
  className,
  animation,
  onCitationClick,
}: MarkdownRendererProps) {
  const content = children ?? ''
  const flag = false
  return (
    <MarkdownProvider animation={animation} onCitationClick={onCitationClick}>
      {flag ? (
        <pre>{content}</pre>
      ) : (
        <Streamdown
          mode={animation ? 'streaming' : 'static'}
          isAnimating={animation}
          animated={animation ? { animation: 'blurIn', duration: 180, easing: 'ease-out' } : false}
          components={components}
          className={cn('article-wrapper max-w-none text-sm', { animation }, className)}
        >
          {content}
        </Streamdown>
      )}
    </MarkdownProvider>
  )
})
