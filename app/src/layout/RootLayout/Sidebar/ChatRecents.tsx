import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'

interface Chat {
  id: string
  title?: string
}

interface ChatRecentProps {
  chats?: Chat[]
}

export function ChatRecents({ chats = [] }: ChatRecentProps) {
  return (
    <div className='flex flex-1 flex-col gap-0.5 overflow-y-auto px-2'>
      {chats.map((chat) => (
        <NavLink
          key={chat.id}
          to={`/chat/${chat.id}`}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5',
              'text-sm',
              'text-text-secondary',
              'transition-colors',
              'hover:bg-foreground/5 hover:text-foreground',
              isActive && 'bg-foreground/8 text-foreground font-medium'
            )
          }
        >
          <span className='block truncate'>{chat.title || 'Untitled'}</span>
        </NavLink>
      ))}

      {chats.length === 0 && (
        <div className='text-text-info px-3 py-4 text-sm'>No active chats</div>
      )}
    </div>
  )
}

