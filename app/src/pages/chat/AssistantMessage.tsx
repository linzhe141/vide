import { Bot } from 'lucide-react'
import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'
import { useChatContext } from './ChatProvider'

export function AssistantMessage({ content }: { content: string }) {
  const { isRunning } = useChatContext()

  return (
    <div className='flex items-start gap-3'>
      <div className='bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full'>
        <Bot className='text-primary h-4 w-4' />
      </div>
      <div className='border-border bg-background w-full max-w-3xl rounded-2xl rounded-tl-sm border px-5 py-3 shadow-sm'>
        <MarkdownRenderer className='text-foreground font-sans text-sm' animation={isRunning}>
          {content}
        </MarkdownRenderer>
      </div>
    </div>
  )
}
