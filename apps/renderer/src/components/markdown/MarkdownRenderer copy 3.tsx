import { memo, useContext } from 'react'
import MarkdownRender, {
  setCustomComponents,
  type LinkNodeProps,
  type NodeComponentProps,
} from 'markstream-react'
import 'markstream-react/index.css'
import { cn } from '../../lib/utils'
import { ChatLayoutContext } from '@/hooks/useChatLayout'
import { MarkdownContext } from '@/hooks/useMarkdown'
import { useTheme } from '@/hooks/useTheme'
import { MarkdownProvider } from './MarkdownProvider'

const MARKDOWN_RENDERER_ID = 'vide-markdown-renderer'

type MarkdownRendererProps = {
  children?: string | null
  className?: string
  animation: boolean
  onCitationClick?: () => void
}

type CitationLinkNodeProps = NodeComponentProps<LinkNodeProps['node']>

function renderLinkChildren({ node, ctx, renderNode, indexKey }: CitationLinkNodeProps) {
  if (!node.children?.length || !renderNode || !ctx) {
    return node.text
  }

  return node.children.map((child, childIndex) =>
    renderNode(child, `${String(indexKey ?? 'link')}-${childIndex}`, ctx)
  )
}

const CitationLinkNode = memo(function CitationLinkNode(props: CitationLinkNodeProps) {
  const chatLayout = useContext(ChatLayoutContext)
  const markdown = useContext(MarkdownContext)
  const isWebSearchLink = /^\d+$/.test(props.node.text.trim())
  const children = renderLinkChildren(props)

  if (isWebSearchLink) {
    return (
      <button
        type='button'
        className='bg-primary/20 mx-1 inline-flex size-4 cursor-pointer items-center justify-center rounded-full text-center text-[10px]'
        onClick={() => {
          markdown?.onCitationClick?.()
          chatLayout?.showWebSearchResults()
        }}
      >
        {props.node.text}
      </button>
    )
  }

  return (
    <a
      href={props.node.href}
      title={props.node.title ?? undefined}
      target='_blank'
      rel='noreferrer'
    >
      {children}
    </a>
  )
})

setCustomComponents(MARKDOWN_RENDERER_ID, {
  link: CitationLinkNode,
})

export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
  className,
  animation,
  onCitationClick,
}: MarkdownRendererProps) {
  const { theme } = useTheme()

  return (
    <MarkdownProvider animation={animation} onCitationClick={onCitationClick}>
      <article className={cn('prose dark:prose-invert prose-zinc prose-sm max-w-none', className)}>
        <MarkdownRender
          customId={MARKDOWN_RENDERER_ID}
          content={children ?? ''}
          final={!animation}
          // fade={animation}
          smoothStreaming={animation}
          isDark={theme === 'dark'}
          codeBlockProps={{
            showHeader: false,
            showCopyButton: true,
          }}
        />
      </article>
    </MarkdownProvider>
  )
})
