import Markdown, { type Options as ReactMarkdownOptions } from 'react-markdown'
import { codeToTokens } from '../highlight/shiki'
import { THEME } from '../highlight/codeTheme'
import { memo, type PropsWithChildren, type ReactElement } from 'react'
import { cn } from '../../lib/utils'
import { AnimatedWrapper } from './animation'

const components = {
  a: ({ ...props }: PropsWithChildren) => (
    <a {...props} target='_blank'>
      {props.children}
    </a>
  ),
  p: ({ children }: PropsWithChildren) => (
    <p className='break-words'>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </p>
  ),
  h1: ({ children }: PropsWithChildren) => (
    <h1>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h1>
  ),
  h2: ({ children }: PropsWithChildren) => (
    <h2>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h2>
  ),
  h3: ({ children }: PropsWithChildren) => (
    <h3>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h3>
  ),
  li: ({ children }: PropsWithChildren) => (
    <li>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </li>
  ),
  strong: ({ children }: PropsWithChildren) => (
    <strong>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </strong>
  ),
  pre: (props: PropsWithChildren) => {
    const codeElement = props.children as ReactElement<PropsWithChildren>
    const code = codeElement.props.children as string
    if (code) {
      const language = getCodeLanguage(codeElement)
      const tokens = codeToTokens(code, language)
      return (
        <pre
          data-language={language}
          className={cn('hightligh-code-wrapper overflow-auto rounded bg-[#181818]')}
          style={{ ...THEME.dark, fontSize: '14px' }}
        >
          {tokens.tokens.map((row, index) => (
            <span key={index} className='block'>
              {row.map((token, tokenIndex) => (
                <span
                  key={tokenIndex}
                  style={{
                    color: token.color,
                    backgroundColor: token.bgColor,
                    ...token.htmlStyle,
                  }}
                  {...token.htmlAttrs}
                >
                  {token.content}
                </span>
              ))}
            </span>
          ))}
        </pre>
      )
    }
    return <pre>{codeElement}</pre>
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

function getCodeLanguage(codeElement: ReactElement<any>) {
  if (!codeElement.props.className) return ''
  // eslint-disable-next-line no-unsafe-optional-chaining
  const [_, language] = codeElement.props.className?.split('language-')
  return language as string
}
