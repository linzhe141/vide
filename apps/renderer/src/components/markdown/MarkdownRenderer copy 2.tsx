import { cn } from '../../lib/utils'
import MarkdownReact, { type Options as ReactMarkdownOptions } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { memo, useMemo, type FC } from 'react'
import { MarkdownProvider } from './MarkdownProvider'
import { rehypeStreamAnimated } from './animation/rehypeStreamAnimated'
import { marked } from 'marked'
import { components } from './components'

const markdownRemarkPlugins = [remarkGfm]
const streamRehypePlugins = [rehypeStreamAnimated]
const markdownRehypePlugins: ReactMarkdownOptions['rehypePlugins'] = []

const parseMarkdownIntoBlocks = (markdown: string) => {
  return marked.lexer(markdown).map((token) => token.raw)
}

const MemoMarkdown: FC<ReactMarkdownOptions> = memo(({ children, ...rest }) => {
  return <MarkdownReact {...rest}>{children}</MarkdownReact>
})

export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
  className,
  animation,
  onCitationClick,
}: ReactMarkdownOptions & {
  className?: string
  animation: boolean
  onCitationClick?: () => void
}) {
  console.log('MarkdownRenderer render')
  const blocks = useMemo(() => {
    if (!animation) return []
    return parseMarkdownIntoBlocks(children ?? '')
  }, [animation, children])

  return (
    <MarkdownProvider animation={animation} onCitationClick={onCitationClick}>
      <article
        className={cn(
          'article-wrapper prose dark:prose-invert prose-zinc prose-sm max-w-none',
          { animation },
          className
        )}
      >
        {animation ? (
          blocks.map((block, index) => (
            <MemoMarkdown
              key={index}
              rehypePlugins={streamRehypePlugins}
              remarkPlugins={markdownRemarkPlugins}
              components={components}
            >
              {block}
            </MemoMarkdown>
          ))
        ) : (
          <MemoMarkdown
            rehypePlugins={markdownRehypePlugins}
            components={components}
            remarkPlugins={markdownRemarkPlugins}
          >
            {children}
          </MemoMarkdown>
        )}
      </article>
    </MarkdownProvider>
  )
})
