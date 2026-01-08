import { Outlet } from 'react-router'
import { SideBar } from './Sidebar'
import { WindowCtrl } from './WindowCtrl'

export default function Layout() {
  return (
    <div className='flex h-screen w-screen flex-col'>
      <WindowCtrl></WindowCtrl>
      <div className='flex h-0 flex-1'>
        <SideBar></SideBar>
        <main className='w-0 flex-1 overflow-auto'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
