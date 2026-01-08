import { Minus, Square, X } from 'lucide-react'
import Logo from '../logo.png'
import type { PropsWithChildren } from 'react'
import { cn } from '@/app/src/lib/utils'

export function WindowCtrl() {
  return (
    <div className='border-border flex h-10 justify-between border-b'>
      <div className='drag-region flex flex-1 items-center px-2'>
        <img className='size-6' src={Logo}></img>
      </div>
      <div className='flex h-full items-center'>
        <WindowOperationItem
          onClick={() => window.ipcRendererApi.invoke('minmize-window')}
        >
          <Minus className='size-4' />
        </WindowOperationItem>

        <WindowOperationItem
          onClick={() => window.ipcRendererApi.invoke('maxmize-window')}
        >
          <Square className='size-4'></Square>
        </WindowOperationItem>

        <WindowOperationItem
          className='hover:!bg-red-600 hover:!text-white'
          onClick={() => window.ipcRendererApi.invoke('close-window')}
        >
          <X className='size-4'></X>
        </WindowOperationItem>
      </div>
    </div>
  )
}

function WindowOperationItem({
  onClick,
  children,
  className,
}: PropsWithChildren<{ onClick: () => void; className?: string }>) {
  return (
    <div
      className={cn(
        'flex size-10 items-center justify-center hover:bg-gray-200 dark:hover:bg-[#373737]',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
