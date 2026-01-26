import { Moon, Sun } from 'lucide-react'
import { useTheme, themeColors, type ThemeColor } from '@/app/src/provider/ThemeProvider'

export function GeneralSettings() {
  const { theme, setTheme, themeColor, setThemeColor } = useTheme()

  return (
    <div className='min-h-screen bg-white transition-colors dark:bg-gray-900'>
      <div className='mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12'>
        {/* Theme Mode Toggle */}
        <div className='flex items-center gap-6'>
          <div className='font-medium text-gray-700 dark:text-gray-300'>Change theme</div>
          <button
            className='transition-transform hover:rotate-45 dark:hidden'
            onClick={() => setTheme('dark')}
          >
            <Sun className='size-7 text-yellow-400 drop-shadow-[0_0_8px_rgba(253,224,71,0.7)] transition-colors' />
          </button>
          <button
            className='hidden transition-transform hover:-rotate-12 dark:block'
            onClick={() => setTheme('light')}
          >
            <Moon className='size-7 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.7)] transition-colors' />
          </button>
        </div>

        {/* Theme Color Selector */}
        <div className='flex flex-col gap-4'>
          <div className='font-medium text-gray-700 dark:text-gray-300'>Theme color</div>
          <div className='flex gap-4'>
            {(Object.keys(themeColors) as ThemeColor[]).map((colorKey) => {
              const isSelected = themeColor === colorKey
              const colorValue = themeColors[colorKey][theme]

              return (
                <button
                  key={colorKey}
                  onClick={() => setThemeColor(colorKey)}
                  className={`group relative size-12 rounded-full transition-all hover:scale-110 ${
                    isSelected
                      ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
                      : ''
                  }`}
                  style={{
                    backgroundColor: colorValue,
                  }}
                >
                  {isSelected && (
                    <div className='absolute inset-0 flex items-center justify-center'>
                      <div className='size-3 rounded-full bg-white dark:bg-gray-900'></div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
