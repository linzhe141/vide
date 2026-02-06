import React, { memo, useMemo } from 'react'
import type { PropsWithChildren } from 'react'
import './animation.css'
const segmenter = new (Intl as any).Segmenter('zh', { granularity: 'word' })

export const AnimatedText = memo(({ text }: { text: string }) => {
  const segments = useMemo(() => {
    return [...segmenter.segment(text)].map((s) => s.segment)
  }, [text])

  return (
    <>
      {segments.map((segment, i) => (
        // 稳定的 key + 内容作为 children
        <span key={`${i}-${segment}`} className='animate-fade-in'>
          {segment}
        </span>
      ))}
    </>
  )
})

const wrapWithAnimation = (node: React.ReactNode, index: number): React.ReactNode => {
  if (typeof node === 'string') {
    return <AnimatedText text={node} key={index}></AnimatedText>
  }
  if (React.isValidElement(node)) {
    const props = node.props as PropsWithChildren
    // 递归处理 children
    const children = Array.isArray(props.children) ? props.children : [props.children]

    const newChildren = children.map(wrapWithAnimation)
    return React.cloneElement(node, { ...props, children: newChildren } as any)
  }

  return node
}

export const AnimatedWrapper = memo(({ children }: { children: React.ReactNode }) => {
  const wrapped = React.Children.map(children, wrapWithAnimation)
  return <>{wrapped}</>
})
