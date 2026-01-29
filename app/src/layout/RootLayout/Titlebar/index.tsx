import { Minus, Square, X, Copy } from 'lucide-react'
import Logo from '../logo.png'
import { memo, useEffect, useState, type PropsWithChildren } from 'react'
import { cn } from '@/app/src/lib/utils'

const WindowState = {
  MINIMIZED: 'minimized',
  MAXIMIZED: 'maximized',
  NORMAL: 'normal',
} as const
type WindowStateValue = (typeof WindowState)[keyof typeof WindowState]

export const Titlebar = memo(function Titlebar() {
  const [windowState, setWindowState] = useState<WindowStateValue>(WindowState.NORMAL)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const handler = (isMaximized: boolean) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setWindowState(isMaximized ? WindowState.MAXIMIZED : WindowState.NORMAL)
      }, 300)
    }

    const remove = window.ipcRendererApi.on('changed-window-size', handler)

    return () => {
      if (timer) clearTimeout(timer)
      remove()
    }
  }, [])

  const isMaximized = windowState === WindowState.MAXIMIZED
  return (
    <div className='border-border flex h-10 justify-between border-b'>
      <div className='drag-region flex flex-1 items-center px-2'>
        <img className='size-5' src={Logo}></img>
      </div>
      <div className='flex h-full items-center text-black dark:text-white'>
        <WindowOperationItem
          onClick={() => {
            setWindowState(WindowState.MINIMIZED)
            window.ipcRendererApi.invoke('minmize-window')
          }}
        >
          <Minus className='size-5 stroke-1' />
        </WindowOperationItem>

        <WindowOperationItem
          onClick={() => {
            window.ipcRendererApi.invoke('maxmize-window')
            if (isMaximized) {
              setWindowState(WindowState.NORMAL)
            } else {
              setWindowState(WindowState.MAXIMIZED)
            }
          }}
        >
          {isMaximized ? (
            <Copy className='size-5 rotate-90 stroke-1'></Copy>
          ) : (
            <Square className='size-5 stroke-1'></Square>
          )}
        </WindowOperationItem>

        <WindowOperationItem
          className='hover:!bg-red-600 hover:!text-white'
          onClick={() => window.ipcRendererApi.invoke('close-window')}
        >
          <X className='size-5 stroke-1'></X>
        </WindowOperationItem>
      </div>
    </div>
  )
})

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
