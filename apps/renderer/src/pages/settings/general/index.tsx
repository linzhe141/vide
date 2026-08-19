import { Eraser, Moon, Sun } from 'lucide-react'
import { themeColors } from '@/provider/ThemeProvider'
import { type ThemeColor } from '@/hooks/themeContext'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/Button'
import { useSessionStoreActions } from '@/store/sessionStore'

export function GeneralSettings() {
  const { theme, setTheme, themeColor, setThemeColor } = useTheme()
  const { clearSessions } = useSessionStoreActions()

  return (
    <div>
      <div className='mx-auto max-w-3xl px-6 py-14'>
        <header className='mb-10'>
          <h1 className='text-foreground text-2xl font-semibold'>General</h1>
          <p className='text-text-secondary mt-1 text-sm'>Appearance and personalization</p>
        </header>

        <section
          className={cn(
            'border-border rounded-2xl border',
            'bg-background/80 backdrop-blur',
            'p-8 shadow-sm',
            'space-y-10'
          )}
        >
          <div className='flex items-center justify-between'>
            <div>
              <div className='text-foreground font-medium'>Theme</div>
              <div className='text-text-secondary text-sm'>Switch between light and dark mode</div>
            </div>

            <div
              className={cn(
                'flex items-center p-1',
                'border-border rounded-full border',
                'bg-background'
              )}
            >
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all',
                  theme === 'light'
                    ? 'bg-background text-foreground shadow'
                    : 'text-text-secondary hover:text-foreground'
                )}
              >
                <Sun className='text-primary size-4' />
                Light
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all',
                  theme === 'dark'
                    ? 'bg-background text-foreground border-border border shadow'
                    : 'text-text-secondary hover:text-foreground'
                )}
              >
                <Moon className='text-primary size-4' />
                Dark
              </button>
            </div>
          </div>

          <div className='bg-border h-px' />

          <div className='flex items-start justify-between'>
            <div>
              <div className='text-foreground font-medium'>Accent color</div>
              <div className='text-text-secondary text-sm'>
                Used for highlights and primary actions
              </div>
            </div>

            <div className='flex gap-4'>
              {(Object.keys(themeColors) as ThemeColor[]).map((colorKey) => {
                const isSelected = themeColor === colorKey
                const colorValue = themeColors[colorKey][theme]

                return (
                  <button
                    key={colorKey}
                    onClick={() => setThemeColor(colorKey)}
                    className={cn(
                      'relative size-11 rounded-full transition-all',
                      'hover:scale-110 focus:outline-none',
                      isSelected ? 'ring-primary/30 ring-4' : 'ring-border ring-1'
                    )}
                    style={{ backgroundColor: colorValue }}
                  >
                    {isSelected && (
                      <span className='absolute inset-0 flex items-center justify-center'>
                        <span className='bg-background size-3 rounded-full shadow' />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className='bg-border h-px' />

          <div className='flex items-center justify-between'>
            <div>
              <div className='text-foreground font-medium'>Clear database</div>
              <div className='text-text-secondary text-sm'>Only dev mode</div>
            </div>

            <div>
              <Button
                onClick={async () => {
                  const confirmed = confirm('Delete all database records?')
                  if (!confirmed) return

                  try {
                    await window.ipcRendererApi.invoke('dev-delete-database-rows')
                    clearSessions()
                    alert('Database cleared successfully.')
                  } catch (error) {
                    console.error('Failed to delete database rows:', error)
                    alert(
                      'Failed to clear database: ' +
                        (error instanceof Error ? error.message : String(error))
                    )
                  }
                }}
              >
                <div className='flex items-center gap-2'>
                  <Eraser size={14} />
                  <div>Clear !</div>
                </div>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
