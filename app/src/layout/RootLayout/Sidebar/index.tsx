import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { SidebarFooter } from './SidebarFooter'
import { ChatRecents } from './ChatRecents'
import { Plus } from 'lucide-react'

export function SideBar() {
  const recentChats = [
    { id: '1', title: 'Chat 1', timestamp: new Date() },
    { id: '2', title: 'Chat 2', timestamp: new Date() },
    { id: '3', title: 'Chat 3', timestamp: new Date() },
  ]

  return (
    <aside
      className={cn(
        'bg-background',
        'flex w-[68px] flex-col items-center',
        'border-border/60 border-r',
        'py-3'
      )}
    >
      {/* Primary Action */}
      <NavLink
        to='/'
        className={({ isActive }) =>
          cn(
            'mb-4 flex size-11 items-center justify-center rounded-xl',
            'bg-primary/10 text-primary',
            'transition-all duration-200',
            'hover:bg-primary/15 hover:scale-[1.03]',
            isActive && 'bg-primary/20'
          )
        }
        title='New Chat'
      >
        <Plus className='size-5' />
      </NavLink>

      {/* Recents */}
      <ChatRecents chats={recentChats} />

      {/* Footer */}
      <SidebarFooter />
    </aside>
  )
}
