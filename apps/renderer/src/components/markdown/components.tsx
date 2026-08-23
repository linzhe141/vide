import type { PropsWithChildren } from 'react'
import { AnimatedWrapper } from './animation'
import { Pre } from '../codeblock'
import { useChatLayout } from '@/hooks/useChatLayout'
import { useMarkdown } from '@/hooks/useMarkdown'

export function A({ ...props }: PropsWithChildren) {
  const { showWebSearchResults } = useChatLayout()
  const { onCitationClick } = useMarkdown()

  // TODO 如果这里有多次的 web search 结果，无法定位属于哪一个
  // 把 [number](url) 有单独的样式
  const isWebSearchLink = /^\d+$/.test(props.children as string)
  if (isWebSearchLink) {
    return (
      <span
        className='bg-primary/20 mx-1 inline-block size-4 cursor-pointer rounded-full text-center text-[10px]'
        onClick={() => {
          onCitationClick?.()
          showWebSearchResults()
        }}
      >
        {props.children}
      </span>
    )
  }
  return (
    <a {...props} target='_blank'>
      {props.children}
    </a>
  )
}

export function P({ ...props }: PropsWithChildren) {
  return (
    <p className='break-words' {...props}>
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
