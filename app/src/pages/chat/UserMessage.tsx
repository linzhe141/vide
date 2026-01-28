import { User } from 'lucide-react'
import { memo } from 'react'

export const UserMessage = memo(function UserMessage({ content }: { content: string }) {
  return (
    <div className='flex items-start justify-end gap-3' id={'user-input-' + content}>
      <div className='bg-primary max-w-2xl rounded-2xl rounded-tr-sm px-5 py-3 shadow-sm'>
        <p className='text-sm leading-relaxed text-white'>{content}</p>
      </div>
      <div className='bg-primary/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full'>
        <User className='text-primary h-4 w-4' />
      </div>
    </div>
  )
})
