import MarkdownReact, { type Options as ReactMarkdownOptions } from 'react-markdown'
import { useMemo, type PropsWithChildren } from 'react'
import { cn } from '../../lib/utils'
import { AnimatedWrapper } from './animation'
import { Pre } from '../Pre/Pre'
import { MarkdownProvider } from './MarkdownProvider'
import { rehypeStreamAnimated } from './animation/rehypeStreamAnimated'

function A({ ...props }: PropsWithChildren) {
  return (
    <a {...props} target='_blank'>
      {props.children}
    </a>
  )
}

function P({ ...props }: PropsWithChildren) {
  return (
    <p className='break-words' {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </p>
  )
}

function H1({ ...props }: PropsWithChildren) {
  return (
    <h1 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h1>
  )
}

function H2({ ...props }: PropsWithChildren) {
  return (
    <h2 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h2>
  )
}

function H3({ ...props }: PropsWithChildren) {
  return (
    <h3 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h3>
  )
}

function Li({ ...props }: PropsWithChildren) {
  return (
    <li {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </li>
  )
}

function Strong({ ...props }: PropsWithChildren) {
  return (
    <strong {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </strong>
  )
}

const components = {
  // a: A,
  // p: P,
  // h1: H1,
  // h2: H2,
  // h3: H3,
  // li: Li,
  // strong: Strong,
  pre: Pre,
}

export function MarkdownRenderer({
  children,
  className,
  animation,
}: ReactMarkdownOptions & { className?: string; animation: boolean }) {
  const rehypePlugins = useMemo(() => {
    if (animation) {
      return [rehypeStreamAnimated]
    }
    return []
  }, [animation])

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
        <MarkdownReact components={components} rehypePlugins={rehypePlugins}>
          {children}
        </MarkdownReact>
      </article>
    </MarkdownProvider>
  )
}
