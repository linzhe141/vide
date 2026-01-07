import { Outlet } from 'react-router'
import { SideBar } from './Sidebar'

export default function Layout() {
  return (
    <div className='flex h-screen w-screen'>
      <SideBar></SideBar>
      <main className='h-0 flex-1 overflow-auto'>
        <Outlet />
      </main>
    </div>
  )
}
