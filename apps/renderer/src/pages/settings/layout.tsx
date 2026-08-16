import { Outlet, useLocation } from 'react-router'
import { LinkMenu } from '../../ui/LinkMenu'
import { LinkMenuItem } from '../../ui/LinkMenu/LinkMenuItem'

export function Layout() {
  const { pathname } = useLocation()

  const currentLink = pathname
  return (
    <div className='flex h-full'>
      <div className='border-border w-75 border-r p-4'>
        <div className='my-3'>
          <div className='text-3xl'>Settings</div>
          <div className='text-text-info text-xs'>Preferences and LLM settings.</div>
        </div>
        <div>
          <LinkMenu defaultLink={currentLink}>
            <LinkMenuItem label='Preferences settings' link='/settings'></LinkMenuItem>
            <LinkMenuItem label='LLM settings' link='/settings/llm'></LinkMenuItem>
            <LinkMenuItem label='Generate Image' link='/settings/generateImage'></LinkMenuItem>
            <LinkMenuItem label='Web Search' link='/settings/webSearch'></LinkMenuItem>
            <LinkMenuItem label='WeChat Bot' link='/settings/wechat'></LinkMenuItem>
          </LinkMenu>
        </div>
      </div>
      <div className='w-0 flex-1 overflow-auto'>
        <Outlet />
      </div>
    </div>
  )
}
