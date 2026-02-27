import { memo } from 'react'
import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'

export const AssistantMessage = memo(
  ({ content, animation }: { content: string; animation: boolean }) => {
    return (
      <div className='w-full items-start gap-3'>
        <div className='border-border bg-background w-full rounded-2xl rounded-tl-sm border px-5 py-3 shadow-sm'>
          <MarkdownRenderer className='text-foreground font-sans text-sm' animation={animation}>
            {content}
          </MarkdownRenderer>
        </div>
      </div>
    )
  },
  (prev, next) => prev.content === next.content && prev.animation === next.animation
)
