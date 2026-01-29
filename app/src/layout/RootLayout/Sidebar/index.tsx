import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { SidebarFooter } from './SidebarFooter'
import { ChatRecents } from './ChatRecents'
import { Plus } from 'lucide-react'

export function SideBar() {
  // 示例数据 - 实际使用时从状态管理或 API 获取
  const recentChats = [
    { id: '1', title: 'Chat 1', timestamp: new Date() },
    { id: '2', title: 'Chat 2', timestamp: new Date() },
    { id: '3', title: 'Chat 3', timestamp: new Date() },
  ]

  return (
    <aside
      className={cn(
        'bg-background border-border',
        'flex w-20 flex-col items-center',
        'border-r px-2 py-3'
      )}
    >
      {/* Logo / Home */}
      <div className='flex flex-col items-center gap-2'>
        <NavLink
          to='/'
          className={({ isActive }) =>
            cn(
              'group flex size-10 items-center justify-center rounded-lg',
              'border-border border',
              'transition-all duration-200 ease-out',
              'hover:bg-foreground/5 hover:scale-105',
              'text-foreground',
              isActive && 'border-primary'
            )
          }
        >
          <Plus className={cn('size-5', 'transition-colors duration-200')} />
        </NavLink>
      </div>

      {/* Chat Recent - 占据中间可滚动区域 */}
      <ChatRecents chats={recentChats} />

      <SidebarFooter />
    </aside>
  )
}
