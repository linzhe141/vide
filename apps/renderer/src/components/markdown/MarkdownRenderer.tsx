import { Markdown } from '@lobehub/ui'

export function MarkdownRenderer({
  children,
  animation,
}: {
  className?: string
  animation: boolean
  children: any
}) {
  return <Markdown animated={animation}>{children ?? ''}</Markdown>
}
