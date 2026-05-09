import type { AssistantTextThreadMessage } from '../../store/threadStore'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

export function AssistantTextMessage({ message }: { message: AssistantTextThreadMessage }) {
  return (
    <div className='max-w-none'>
      <MarkdownRenderer
        animation
        className='text-foreground prose prose-sm dark:prose-invert max-w-none leading-8'
      >
        {message.content}
      </MarkdownRenderer>
    </div>
  )
}
