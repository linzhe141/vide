import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { MessageSquare } from 'lucide-react'

interface Chat {
  id: string
  title?: string
  timestamp: Date
}

interface ChatRecentProps {
  chats?: Chat[]
}

export function ChatRecents({ chats = [] }: ChatRecentProps) {
  return (
    <div className='flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-1'>
      {chats.map((chat) => (
        <NavLink
          key={chat.id}
          to={`/chat/${chat.id}`}
          title={chat.title || 'Untitled Chat'}
          className={({ isActive }) =>
            cn(
              'group flex size-10 items-center justify-center rounded-xl',
              'text-text-secondary',
              'transition-all duration-150',
              'hover:bg-foreground/5 hover:text-foreground',
              isActive && 'bg-primary/15 text-primary shadow-[0_0_0_1px_var(--color-primary)]'
            )
          }
        >
          <MessageSquare className='size-4.5' />
        </NavLink>
      ))}

      {chats.length === 0 && (
        <div className='text-text-info mt-4 flex flex-col items-center gap-1'>
          <MessageSquare className='size-4' />
          <span className='text-[10px]'>No chats</span>
        </div>
      )}
    </div>
  )
}
