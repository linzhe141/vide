import { cn } from '@/app/src/lib/utils'
import { SidebarFooter } from './SidebarFooter'

export function SideBar() {
  return (
    <aside
      className={cn(
        'border-border flex w-15 flex-col items-center justify-between border-r-1 pt-2'
      )}
    >
      <div>
        <div className='flex size-10 items-center justify-center rounded-full'>
          logo
        </div>
      </div>

      <SidebarFooter></SidebarFooter>
    </aside>
  )
}
