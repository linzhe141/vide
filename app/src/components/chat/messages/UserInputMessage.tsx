import type { UserInputThreadMessage } from '@/app/src/store/threadStore'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'

export function UserInputMessage({ message }: { message: UserInputThreadMessage }) {
  return (
    <div className='flex justify-end'>
      <div className='border-foreground/10 dark:border-foreground/25 max-w-[min(78%,680px)] rounded-[24px] rounded-tr-md border px-5 py-3 text-[15px] leading-7 shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)]'>
        <MarkdownRenderer animation={false} className='text-inherit'>
          {message.content}
        </MarkdownRenderer>
      </div>
    </div>
  )
}
