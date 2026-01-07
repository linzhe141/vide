import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/app/src/provider/ThemeProvider'

export function GeneralSettings() {
  const { setTheme } = useTheme()
  return (
    <div className='mx-auto flex max-w-3xl items-center gap-6 px-6 py-12'>
      <div>change theme</div>
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
  )
}
