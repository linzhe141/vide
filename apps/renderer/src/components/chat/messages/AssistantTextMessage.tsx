import type { AssistantTextSessionMessage } from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'

export function AssistantTextMessage({ message }: { message: AssistantTextSessionMessage }) {
  return (
    <div className='max-w-none'>
      <MarkdownRenderer animation={message.streaming}>{message.content}</MarkdownRenderer>
    </div>
  )
}
