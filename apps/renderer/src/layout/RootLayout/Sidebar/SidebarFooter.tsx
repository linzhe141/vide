import { NavLink } from 'react-router'
import { Monitor, Settings, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const linkClass = (isActive: boolean) =>
    cn(
      'group flex size-10 items-center justify-center rounded-xl',
      'transition-all duration-200 ease-out',
      'hover:bg-foreground/5 hover:scale-105',
      isActive ? 'bg-primary/20 text-primary' : 'text-text-secondary'
    )

  return (
    <div
      className={cn('border-border w-full border-t px-4 py-2', 'flex gap-1', [
        collapsed ? 'flex-col items-center' : 'flex-col items-stretch',
      ])}
    >
      {!collapsed && (
        <NavLink
          to='/multi-window-demo'
          className='hover:bg-foreground/5 flex items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors'
        >
          <span className='bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl'>
            <Monitor className='size-5' />
          </span>
          <span className='min-w-0'>
            <span className='text-foreground block text-sm font-medium'>Foo demo</span>
            <span className='text-text-secondary block truncate text-xs'>
              Open the IPC message panel
            </span>
          </span>
        </NavLink>
      )}

      <div className={cn('flex items-center gap-1', collapsed ? 'flex-col' : 'flex-row')}>
        {collapsed && (
          <NavLink
            to='/multi-window-demo'
            className={({ isActive }) => linkClass(isActive)}
            title='Open foo demo'
            aria-label='Open foo demo'
          >
            <Monitor className='group-hover:text-primary size-5 transition-transform duration-300 ease-out' />
          </NavLink>
        )}
        <NavLink to='/skills' className={({ isActive }) => linkClass(isActive)} title='Skills'>
          <Sparkles className='group-hover:text-primary size-5 transition-transform duration-300 ease-out' />
        </NavLink>
        <NavLink to='/settings' className={({ isActive }) => linkClass(isActive)} title='Settings'>
          <Settings
            className={cn(
              'size-5',
              'transition-transform duration-300 ease-out',
              'group-hover:text-primary group-hover:rotate-90'
            )}
          />
        </NavLink>
      </div>
    </div>
  )
}
