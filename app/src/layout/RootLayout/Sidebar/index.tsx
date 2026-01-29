import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { SidebarFooter } from './SidebarFooter'
import { ChatRecents } from './ChatRecents'
import { Plus } from 'lucide-react'

export function SideBar() {
  const recentChats = [
    { id: '1', title: 'Streaming markdown design' },
    { id: '2', title: 'Agent message model' },
    { id: '3', title: 'UI token refactor' },
    { id: '4', title: 'React 18 scheduling notes' },
  ]

  return (
    <aside
      className={cn('bg-background', 'flex h-full w-[240px] flex-col', 'border-border/50 border-r')}
    >
      {/* New Chat */}
      <div className='p-3'>
        <NavLink
          to='/'
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2',
            'bg-foreground/5 text-foreground',
            'text-sm font-medium',
            'transition-colors',
            'hover:bg-foreground/8'
          )}
        >
          <Plus className='size-4 opacity-70' />
          New chat
        </NavLink>
      </div>

      {/* Flat chat switcher */}
      <ChatRecents chats={recentChats} />

      <SidebarFooter />
    </aside>
  )
}
