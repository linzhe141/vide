import { Outlet } from 'react-router'
import { SideBar } from './Sidebar'
import { Titlebar } from './Titlebar'

export default function Layout() {
  return (
    <div className='flex h-screen w-screen flex-col'>
      <Titlebar></Titlebar>
      <div className='flex h-0 flex-1'>
        <SideBar></SideBar>
        <main className='w-0 flex-1 overflow-auto'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
