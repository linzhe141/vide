import { useState } from 'react'
import { NavLink } from 'react-router'
import { Plus, ChevronLeft } from 'lucide-react'
import { cn } from '@/app/src/lib/utils'
import { SidebarFooter } from './SidebarFooter'
import { ThreadRecents } from './ThreadRecents'

export function SideBar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'bg-background border-border/50 flex h-full flex-col border-r',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[56px]' : 'w-[240px]'
      )}
    >
      {/* Header */}
      <div className='relative p-3'>
        <NavLink
          to='/'
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2',
            'bg-foreground/5 text-foreground',
            'text-sm font-medium',
            'transition-colors',
            'hover:bg-foreground/8',
            collapsed && 'justify-center px-0'
          )}
        >
          <Plus className='size-4 opacity-70' />
          {!collapsed && 'New chat'}
        </NavLink>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            'absolute top-1/2 -right-3 -translate-y-1/2',
            'flex size-6 items-center justify-center rounded-full',
            'border-border bg-background border',
            'text-text-secondary',
            'hover:text-foreground hover:bg-foreground/5',
            'transition'
          )}
        >
          <ChevronLeft className={cn('size-3 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Chat list */}
      <div
        className={cn(
          'flex-1 transition-opacity duration-150',
          collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
      >
        <ThreadRecents />
      </div>

      {/* Footer */}
      <div
        className={cn(
          'transition-opacity duration-150',
          collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
      >
        <SidebarFooter />
      </div>
    </aside>
  )
}
