import type { AssistantTextSessionMessage } from '@/app/src/store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'

export function AssistantTextMessage({ message }: { message: AssistantTextSessionMessage }) {
  return (
    <div className='max-w-none'>
      <MarkdownRenderer
        animation={message.streaming}
        className='text-foreground prose prose-sm dark:prose-invert max-w-none leading-8'
      >
        {message.content}
      </MarkdownRenderer>
    </div>
  )
}
