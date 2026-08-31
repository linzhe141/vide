import { appLogoUrl } from '@/lib/appLogo'

export function Titlebar() {
  return (
    <div className='border-border drag-region flex h-9 items-center justify-between px-2'>
      <img className='size-5' src={appLogoUrl} alt='vide logo' />
    </div>
  )
}
