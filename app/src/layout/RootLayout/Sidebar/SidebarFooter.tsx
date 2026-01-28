import { NavLink } from 'react-router'
import { Settings } from 'lucide-react'
import { cn } from '@/app/src/lib/utils'

export function SidebarFooter() {
  return (
    <div className={cn('border-border w-full border-t pt-2', 'flex flex-col items-center gap-1')}>
      <NavLink
        to='/settings'
        className={({ isActive }) =>
          cn(
            'group flex size-10 items-center justify-center rounded-xl',
            'transition-all duration-200 ease-out',
            'hover:bg-foreground/5 hover:scale-105',
            isActive && 'bg-primary/20'
          )
        }
      >
        <Settings
          className={cn(
            'size-5',
            'text-text-secondary',
            'transition-transform duration-300 ease-out',
            'group-hover:text-primary group-hover:rotate-90'
          )}
        />
      </NavLink>
    </div>
  )
}
