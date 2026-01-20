import React from 'react'
import type { PropsWithChildren } from 'react'
import './animation.css'
const segmentText = (text: string) => {
  const segmenter = new (Intl as any).Segmenter('zh', { granularity: 'word' })
  return [...segmenter.segment(text)].map((s, i) => (
    <span key={i} className='animate-fade-in'>
      {s.segment}
    </span>
  ))
}

const wrapWithAnimation = (node: React.ReactNode): React.ReactNode => {
  if (typeof node === 'string') {
    return segmentText(node)
  }
  if (React.isValidElement(node)) {
    const props = node.props as PropsWithChildren
    // 递归处理 children
    const children = props.children
    const newChildren = Array.isArray(children)
      ? children.map(wrapWithAnimation)
      : wrapWithAnimation(children)

    return React.cloneElement(node, { ...props, children: newChildren } as any)
  }

  return node
}

export const AnimatedWrapper = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const wrapped = React.Children.map(children, wrapWithAnimation)
  return <>{wrapped}</>
}
