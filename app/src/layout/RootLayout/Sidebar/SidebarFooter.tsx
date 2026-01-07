import { Settings } from 'lucide-react'
import { NavLink } from 'react-router'

export function SidebarFooter() {
  return (
    <div className='border-border flex w-full flex-col items-center gap-2 border-t py-2'>
      <NavLink to='/settings'>
        <Settings className='text-primary transition hover:rotate-90'></Settings>
      </NavLink>
    </div>
  )
}
