import { NavLink, Outlet } from 'react-router'

export function Layout() {
  return (
    <div className='flex h-full'>
      <div className='border-border w-[300px] border-r p-4'>
        <div className='my-3 text-3xl'>Settings</div>
        <div>
          <div>
            <NavLink to='/settings'> theme settings</NavLink>
          </div>
          <div>
            <NavLink to='llm'> llm settings</NavLink>
          </div>
        </div>
      </div>
      <div className='w-0 flex-1 overflow-auto'>
        <Outlet />
      </div>
    </div>
  )
}
