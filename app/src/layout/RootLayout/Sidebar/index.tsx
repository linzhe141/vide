import { useTheme } from "@/app/src/hooks/useTheme"
import { Moon, Sun } from "lucide-react"
import { useEffect } from "react"

export function SideBar() {
  const { setTheme } = useTheme()
  useEffect(() => {
    return window.ipcRendererApi.on('sendChunk', (a) => {
      console.log('sendChunk', a)
    })
  }, [])
  useEffect(() => {
    return window.ipcRendererApi.on('ping', () => {
      console.log('ping')
    })
  }, [])
  useEffect(() => {
    return window.ipcRendererApi.on('foo', (data) => {
      console.log('foo', data)
    })
  }, [])
  return (
    <div className='flex w-15 flex-col items-center justify-between border-r-1 border-gray-200 py-2 dark:border-gray-700/30'>
      <div>
        <div className='flex size-10 items-center justify-center rounded-full bg-gray-300'>
          logo
        </div>
      </div>

      <div>
        <button
          className='transition-transform hover:rotate-45 dark:hidden'
          onClick={() => setTheme('dark')}
        >
          <Sun className='size-7 text-yellow-400 drop-shadow-[0_0_8px_rgba(253,224,71,0.7)] transition-colors' />
        </button>
        <button
          className='hidden transition-transform hover:rotate-30 dark:block'
          onClick={() => setTheme('light')}
        >
          <Moon className='size-7 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.7)] transition-colors' />
        </button>
      </div>
    </div>
  )
}
