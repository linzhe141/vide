import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'
import { useChatContext } from './ChatProvider'

export function AssistantMessage({ content }: { content: string }) {
  const { isRunning } = useChatContext()

  return (
    <div className='w-full items-start gap-3'>
      <div className='border-border bg-background w-full rounded-2xl rounded-tl-sm border px-5 py-3 shadow-sm'>
        <MarkdownRenderer className='text-foreground font-sans text-sm' animation={isRunning}>
          {content}
        </MarkdownRenderer>
      </div>
    </div>
  )
}
