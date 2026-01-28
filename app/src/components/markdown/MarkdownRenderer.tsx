import MarkdownReact, { type Options as ReactMarkdownOptions } from 'react-markdown'
import { memo, type PropsWithChildren } from 'react'
import { cn } from '../../lib/utils'
import { AnimatedWrapper } from './animation'
import { Pre } from '../Pre/Pre'

const components = {
  a: memo(({ ...props }: PropsWithChildren) => (
    <a {...props} target='_blank'>
      {props.children}
    </a>
  )),
  p: memo(({ children }: PropsWithChildren) => (
    <p className='break-words'>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </p>
  )),
  h1: memo(({ children }: PropsWithChildren) => (
    <h1>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h1>
  )),
  h2: memo(({ children }: PropsWithChildren) => (
    <h2>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h2>
  )),
  h3: memo(({ children }: PropsWithChildren) => (
    <h3>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </h3>
  )),
  li: memo(({ children }: PropsWithChildren) => (
    <li>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </li>
  )),
  strong: memo(({ children }: PropsWithChildren) => (
    <strong>
      <AnimatedWrapper>{children}</AnimatedWrapper>
    </strong>
  )),
  pre: Pre,
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
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
      <MarkdownReact components={components}>{children}</MarkdownReact>
    </article>
  )
})
