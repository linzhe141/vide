import { NavLink } from 'react-router'
import { Settings, Sparkles } from 'lucide-react'
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
      className={cn('border-border w-full border-t px-4 py-2', 'flex items-center gap-1', [
        collapsed ? 'flex-col' : 'flex-row',
      ])}
    >
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
  )
}
