import type { AnchorHTMLAttributes, PropsWithChildren } from 'react'
import { AnimatedWrapper } from './animation'
import { Pre } from '../codeblock'
import { useChatLayout } from '@/hooks/useChatLayout'
import { useMarkdown } from '@/hooks/useMarkdown'
import { cn } from '../../lib/utils'

export function A({ ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  const { showWebSearchResults } = useChatLayout()
  const { onCitationClick } = useMarkdown()
  const href = typeof props.href === 'string' ? props.href : undefined
  const citationLabel = Array.isArray(props.children)
    ? props.children.join('')
    : String(props.children ?? '')

  // TODO 如果这里有多次的 web search 结果，无法定位属于哪一个
  // 把 [number](url) 有单独的样式
  const isWebSearchLink = /^\d+$/.test(props.children as string)
  if (isWebSearchLink) {
    return (
      <button
        type='button'
        className='bg-primary/20 text-primary focus-visible:ring-primary/25 hover:bg-primary/28 mx-1 inline-flex size-4 items-center justify-center rounded-full text-center text-[10px] transition-colors'
        onClick={() => {
          onCitationClick?.()
          showWebSearchResults()
        }}
        aria-label={`Open citation ${citationLabel}`}
      >
        {props.children}
      </button>
    )
  }

  if (href === 'streamdown:incomplete-link') {
    return <span className={props.className}>{props.children}</span>
  }

  return (
    <a
      {...props}
      href={href}
      target='_blank'
      rel='noreferrer'
      className={cn(
        'text-primary underline underline-offset-4 transition hover:opacity-80',
        props.className
      )}
    >
      {props.children}
    </a>
  )
}

export function P({ ...props }: PropsWithChildren) {
  return (
    <p className='wrap-break-word' {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </p>
  )
}

export function H1({ ...props }: PropsWithChildren) {
  return (
    <h1 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h1>
  )
}

export function H2({ ...props }: PropsWithChildren) {
  return (
    <h2 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h2>
  )
}

export function H3({ ...props }: PropsWithChildren) {
  return (
    <h3 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h3>
  )
}

export function Li({ ...props }: PropsWithChildren) {
  return (
    <li {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </li>
  )
}

export function Strong({ ...props }: PropsWithChildren) {
  return (
    <strong {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </strong>
  )
}

export const components = {
  a: A,
  // p: P,
  // h1: H1,
  // h2: H2,
  // h3: H3,
  // li: Li,
  // strong: Strong,
  pre: Pre,
}
