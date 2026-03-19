import { cn } from '../../lib/utils'
import MarkdownReact, { type Options as ReactMarkdownOptions } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { memo, useMemo, type FC } from 'react'
import { MarkdownProvider } from './MarkdownProvider'
import { rehypeStreamAnimated } from './animation/rehypeStreamAnimated'
import { marked } from 'marked'
import { components } from './components'

const streamRehypePlugins = [rehypeStreamAnimated]
const markdownRehypePlugins: ReactMarkdownOptions['rehypePlugins'] = []

const parseMarkdownIntoBlocks = (markdown: string) => {
  return marked.lexer(markdown).map((token) => token.raw)
}

/**
 * ✅ 精确 memo
 */
const MemoMarkdown: FC<ReactMarkdownOptions> = memo(
  ({ children, ...rest }) => {
    return <MarkdownReact {...rest}>{children}</MarkdownReact>
  },
  (prev, next) => {
    return (
      prev.children === next.children &&
      prev.rehypePlugins === next.rehypePlugins &&
      prev.components === next.components
    )
  }
)

export function MarkdownRenderer({
  children,
  className,
  animation,
}: ReactMarkdownOptions & { className?: string; animation: boolean }) {
  /**
   * ✅ 避免每次 render 重新 tokenize markdown
   */
  const blocks = useMemo(() => {
    return parseMarkdownIntoBlocks(children ?? '')
  }, [children])

  return (
    <MarkdownProvider animation={animation}>
      <article
        className={cn(
          'article-wrapper prose dark:prose-invert prose-slate max-w-none',
          { animation },
          className
        )}
      >
        {animation ? (
          blocks.map((block, index) => (
            <MemoMarkdown
              key={index}
              rehypePlugins={streamRehypePlugins}
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {block}
            </MemoMarkdown>
          ))
        ) : (
          <MemoMarkdown
            rehypePlugins={markdownRehypePlugins}
            components={components}
            remarkPlugins={[remarkGfm]}
          >
            {children}
          </MemoMarkdown>
        )}
      </article>
    </MarkdownProvider>
  )
}
