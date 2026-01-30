import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { useEffect, useState } from 'react'

interface Chat {
  id: string
  title?: string
}

export function ChatRecents() {
  const [chats, setChats] = useState<Chat[]>([])
  useEffect(() => {
    async function fetchChats() {
      const res = await window.ipcRendererApi.invoke('threads-list')
      const result = res as Chat[]
      setChats(result)
    }
    fetchChats()
  }, [])

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
