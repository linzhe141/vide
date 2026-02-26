import { cn } from '../../lib/utils'
import MarkdownReact, { type Options as ReactMarkdownOptions } from 'react-markdown'
import { memo, useMemo, type FC, type PropsWithChildren } from 'react'
import { MarkdownProvider } from './MarkdownProvider'
import { rehypeStreamAnimated } from './animation/rehypeStreamAnimated'
import { marked } from 'marked'
import { components } from './components'

const streamRehypePlugins = [rehypeStreamAnimated]
const markdownRehypePlugins: ReactMarkdownOptions['rehypePlugins'] = []

const parseMarkdownIntoBlocks = (markdown: string) => {
  return marked.lexer(markdown).map((token) => token.raw)
}

const MemoMarkdowndown: FC<PropsWithChildren<ReactMarkdownOptions>> = memo(
  ({ children, ...rest }) => {
    return <MarkdownReact {...rest}>{children}</MarkdownReact>
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

export function MarkdownRenderer({
  children,
  className,
  animation,
}: ReactMarkdownOptions & { className?: string; animation: boolean }) {
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children ?? ''), [children])
  console.log('blocks', blocks)

  return (
    <MarkdownProvider animation={animation}>
      <article
        className={cn(
          'article-wrapper prose dark:prose-invert prose-slate max-w-none',
          {
            animation,
          },
          className
        )}
      >
        {animation ? (
          blocks.map((block, index) => (
            <MemoMarkdowndown
              key={index}
              rehypePlugins={streamRehypePlugins}
              components={components}
            >
              {block}
            </MemoMarkdowndown>
          ))
        ) : (
          <MemoMarkdowndown rehypePlugins={markdownRehypePlugins} components={components}>
            {children}
          </MemoMarkdowndown>
        )}
      </article>
    </MarkdownProvider>
  )
}
