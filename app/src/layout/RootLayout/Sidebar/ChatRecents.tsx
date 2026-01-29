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
    <div className='flex flex-1 flex-col gap-2 overflow-y-auto py-2'>
      {/* Recent Chats */}
      <div className='flex flex-col gap-1.5'>
        {chats.map((chat) => (
          <NavLink
            key={chat.id}
            to={`/chat/${chat.id}`}
            className={({ isActive }) =>
              cn(
                'group relative flex size-10 items-center justify-center rounded-lg',
                'border-border border',
                'transition-all duration-200 ease-out',
                'hover:bg-foreground/5',
                'text-foreground/70 hover:text-foreground',
                isActive && 'bg-foreground/5 border-primary text-foreground'
              )
            }
            title={chat.title || 'Untitled Chat'}
          >
            <MessageSquare className='size-5' />
          </NavLink>
        ))}
      </div>

      {/* Empty State */}
      {chats.length === 0 && (
        <div className='text-foreground/40 flex flex-col items-center gap-2 py-4'>
          <MessageSquare className='size-5' />
          <span className='px-1 text-center text-[10px]'>No chats</span>
        </div>
      )}
    </div>
  )
}
