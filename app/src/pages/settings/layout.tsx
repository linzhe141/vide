import { Outlet } from 'react-router'
import { LinkMenu } from '../../ui/LinkMenu'
import { LinkMenuItem } from '../../ui/LinkMenu/LinkMenuItem'

export function Layout() {
  return (
    <div className='flex h-full'>
      <div className='border-border w-[300px] border-r p-4'>
        <div className='my-3'>
          <div className='text-3xl'>Settings</div>
          <div className='text-text-info text-xs'>
            Preferences and LLM settings.
          </div>
        </div>
        <div>
          <LinkMenu defaultLink={'/settings'}>
            <LinkMenuItem
              label='Preferences settings'
              link='/settings'
            ></LinkMenuItem>
            <LinkMenuItem label='LLM settings' link='llm'></LinkMenuItem>
          </LinkMenu>
        </div>
      </div>
      <div className='w-0 flex-1 overflow-auto'>
        <Outlet />
      </div>
    </div>
  )
}
