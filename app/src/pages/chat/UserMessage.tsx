import { memo } from 'react'

export const UserMessage = memo(function UserMessage({
  content,
  index,
}: {
  content: string
  index: number
}) {
  const anchorId = `user-input-${index}`

  return (
    <div id={anchorId} data-anchor className='flex scroll-mt-24 items-start gap-3'>
      <div className='bg-primary max-w-2xl rounded-2xl rounded-tr-sm px-5 py-3 shadow-sm'>
        <p className='text-sm leading-relaxed text-white'>{content}</p>
      </div>
    </div>
  )
})
