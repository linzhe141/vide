import Markdown, { type Options as ReactMarkdownOptions } from 'react-markdown'
import { AnimatedWrapper } from './animation'
import { codeToHtml } from '../highlight/shiki'
import { THEME } from '../highlight/codeTheme'
import { memo } from 'react'
import { cn } from '../../lib/utils'

const components = {
  a: ({ node, ...props }: any) => (
    <a {...props} target='_blank'>
      {props.children}
    </a>
  ),
  p: ({ children }: any) => (
    <p className='break-words'>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </p>
  ),
  h1: ({ children }: any) => (
    <h1>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h3>
  ),
  li: ({ children }: any) => (
    <li>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </li>
  ),
  strong: ({ children }: any) => (
    <strong>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </strong>
  ),
  pre: (props: any) => {
    const { children } = props as any
    const code = children.props.children
    if (code) {
      const language = getCodeLanguage(children)
      return (
        <div
          data-language={language}
          className={cn('hightligh-code-wrapper overflow-auto rounded bg-[#181818]')}
          dangerouslySetInnerHTML={{
            __html: codeToHtml(code),
          }}
          style={{ ...THEME.dark, fontSize: '15px' }}
        ></div>
      )
    }
    return <pre>{children}</pre>
  },
}

export const MarkdownRenderer = memo(function ({
  children,
  className,
  animation,
}: ReactMarkdownOptions & { className?: string; animation?: boolean }) {
  return (
    <article
      className={cn(
        'article-wrapper prose dark:prose-invert prose-slate max-w-none',
        {
          animation,
        },
        className
      )}
    >
      <Markdown components={components}>{children}</Markdown>
    </article>
  )
})

function getCodeLanguage(children: any) {
  if (!children.props.className) return ''
  // eslint-disable-next-line no-unsafe-optional-chaining
  const [_, language] = children.props.className?.split('language-')
  return language as string
}
