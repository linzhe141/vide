import { memo } from 'react'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

export const UserMessage = memo(function UserMessage({
  content,
  id,
}: {
  content: string
  id: string
}) {
  return (
    <div id={id} data-anchor className='flex scroll-mt-24 items-start gap-3'>
      <div className='bg-primary max-w-2xl rounded-xl rounded-tl-sm px-5 py-3 shadow-sm'>
        <MarkdownRenderer animation={false} className='text-sm text-white'>
          {content}
        </MarkdownRenderer>
      </div>
    </div>
  )
})
