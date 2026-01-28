import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { SidebarFooter } from './SidebarFooter'
import { Home } from 'lucide-react'

export function SideBar() {
  return (
    <aside
      className={cn(
        'bg-background border-border',
        'flex w-15 flex-col items-center justify-between',
        'border-r px-2 py-3'
      )}
    >
      {/* Logo / Home */}
      <div className='flex flex-col items-center gap-2'>
        <NavLink
          to='/'
          className={({ isActive }) =>
            cn(
              'group flex size-10 items-center justify-center rounded-xl',
              'border-border border',
              'transition-all duration-200 ease-out',
              'hover:bg-foreground/5 hover:scale-105',
              isActive && 'bg-primary/20 border-primary/30'
            )
          }
        >
          <Home
            className={cn(
              'size-5',
              'text-text-secondary transition-colors duration-200',
              'group-hover:text-foreground'
            )}
          />
        </NavLink>
      </div>

      <SidebarFooter />
    </aside>
  )
}
