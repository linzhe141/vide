import { Download, Eraser, Moon, RefreshCw, Sun } from 'lucide-react'
import { themeColors } from '@/provider/ThemeProvider'
import { type ThemeColor, useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/Button'
import { useSessionStoreActions } from '@/store/sessionStore'
import { useHistoryStoreActions } from '@/store/historyStore'
import { Alert } from '@/ui/Alert'
import { useEffect, useState } from 'react'

type AppUpdateStatus = {
  phase:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
  message: string
  currentVersion: string
  latestVersion: string | null
  downloadProgress: number | null
  isPackaged: boolean
  allowPrerelease: boolean
  updateAvailable: boolean
  errorMessage: string | null
  willInstallOnQuit: boolean
}

export function GeneralSettings() {
  const { theme, setTheme, themeColor, setThemeColor } = useTheme()
  const { clearSessions } = useSessionStoreActions()
  const { clear } = useHistoryStoreActions()
  const isDevMode = import.meta.env.DEV
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)

  useEffect(() => {
    let mounted = true

    void window.ipcRendererApi.invoke('get-app-update-status').then((status) => {
      if (mounted) setUpdateStatus(status)
    })

    const remove = window.ipcRendererApi.on('app-update-status', (status) => {
      setUpdateStatus(status)
      if (status.phase !== 'checking') {
        setIsCheckingUpdates(false)
      }
    })

    return () => {
      mounted = false
      remove()
    }
  }, [])

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdates(true)
    const status = await window.ipcRendererApi.invoke('check-for-updates')
    setUpdateStatus(status)
    if (status.phase !== 'checking') {
      setIsCheckingUpdates(false)
    }
  }

  const handleInstallUpdate = async () => {
    await window.ipcRendererApi.invoke('install-update-and-restart')
  }

  const handleInstallUpdateLater = async () => {
    const status = await window.ipcRendererApi.invoke('install-update-later')
    setUpdateStatus(status)
  }

  const updateAlertVariant =
    updateStatus?.phase === 'error'
      ? 'fail'
      : updateStatus?.phase === 'downloaded'
        ? 'success'
        : updateStatus?.phase === 'available' || updateStatus?.phase === 'downloading'
          ? 'warn'
          : 'info'

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

          <div className='flex items-start justify-between gap-6'>
            <div className='flex-1 space-y-4'>
              <div>
                <div className='text-foreground font-medium'>Application updates</div>
                <div className='text-text-secondary text-sm'>
                  Current version {updateStatus?.currentVersion ?? '...'}
                  {updateStatus?.latestVersion ? `, latest ${updateStatus.latestVersion}` : ''}
                </div>
              </div>

              {updateStatus ? (
                <Alert variant={updateAlertVariant}>{updateStatus.message}</Alert>
              ) : null}

              {typeof updateStatus?.downloadProgress === 'number' &&
              updateStatus.phase === 'downloading' ? (
                <div className='space-y-2'>
                  <div className='bg-border h-2 overflow-hidden rounded-full'>
                    <div
                      className='bg-primary h-full rounded-full transition-all'
                      style={{
                        width: `${Math.max(0, Math.min(100, updateStatus.downloadProgress))}%`,
                      }}
                    />
                  </div>
                  <div className='text-text-secondary text-xs'>
                    {Math.round(updateStatus.downloadProgress)}% downloaded
                  </div>
                </div>
              ) : null}
            </div>

            <div className='flex shrink-0 gap-3'>
              <Button
                onClick={handleCheckForUpdates}
                disabled={isCheckingUpdates || !updateStatus?.isPackaged}
                variant='outline'
              >
                <div className='flex items-center gap-2'>
                  <RefreshCw size={14} className={cn(isCheckingUpdates && 'animate-spin')} />
                  <div>Check for updates</div>
                </div>
              </Button>

              {updateStatus?.phase === 'downloaded' ? (
                <>
                  <Button onClick={handleInstallUpdateLater} variant='outline'>
                    <div className='flex items-center gap-2'>
                      <Download size={14} />
                      <div>
                        {updateStatus.willInstallOnQuit
                          ? 'Installs on next quit'
                          : 'Install on quit'}
                      </div>
                    </div>
                  </Button>

                  <Button onClick={handleInstallUpdate}>
                    <div className='flex items-center gap-2'>
                      <Download size={14} />
                      <div>Restart to update</div>
                    </div>
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {isDevMode ? (
            <>
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
                        clear()
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
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
