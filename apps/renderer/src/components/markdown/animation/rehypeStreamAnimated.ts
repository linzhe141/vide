// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT
import { type Element, type ElementContent, type Root } from '@/node_modules/@types/hast/index.d'
import { type BuildVisitor } from 'unist-util-visit'
import { visit } from 'unist-util-visit'

// @ts-expect-error ignore missing types
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' })

export const rehypeStreamAnimated = () => {
  return (tree: Root) => {
    visit(tree, 'element', ((node: Element) => {
      if (
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'strong'].includes(node.tagName) &&
        node.children
      ) {
        const newChildren: Array<ElementContent> = []
        for (const child of node.children) {
          if (child.type === 'text') {
            const segments = segmenter.segment(child.value)
            const words = [...segments].map((segment) => segment.segment).filter(Boolean)
            words.forEach((word: string) => {
              newChildren.push({
                children: [{ type: 'text', value: word }],
                properties: {
                  className: 'animate-fade-in',
                },
                tagName: 'span',
                type: 'element',
              })
            })
          } else {
            newChildren.push(child)
          }
        }
        node.children = newChildren
      }
    }) as BuildVisitor<Root, 'element'>)
  }
}
