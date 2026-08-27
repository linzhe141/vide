import { useCallback, useEffect, useState } from 'react'
import type { GitHubAuthRuntimeStatus } from '@vide/config'
import { CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'

type Notice = {
  variant: 'info' | 'success' | 'fail'
  message: string
}

export function GitHubAuthSettings() {
  const [status, setStatus] = useState<GitHubAuthRuntimeStatus | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    let disposed = false

    window.ipcRendererApi.invoke('github-auth-get-runtime-status').then((nextStatus) => {
      if (disposed) return
      setStatus(nextStatus)
      setLoggingIn(nextStatus.pending)
    })

    const remove = window.ipcRendererApi.on('github-auth-status-changed', (nextStatus) => {
      setStatus(nextStatus)
      setLoggingIn(nextStatus.pending)

      if (nextStatus.authenticated && nextStatus.user) {
        setNotice({
          variant: 'success',
          message: 'GitHub 登录成功，测试用户已经写入本地数据库。',
        })
        return
      }

      if (nextStatus.lastError) {
        setNotice({ variant: 'fail', message: nextStatus.lastError })
      }
    })

    return () => {
      disposed = true
      remove()
    }
  }, [])

  const handleLogin = useCallback(async () => {
    setLoggingIn(true)
    setNotice(null)

    try {
      await window.ipcRendererApi.invoke('github-auth-start')
      setNotice({
        variant: 'info',
        message:
          '已在默认浏览器打开 GitHub 授权页。完成授权后，本地 HTTP callback 服务会继续跳转到 vide://oauth/callback 唤醒当前应用。',
      })
    } catch (error) {
      setLoggingIn(false)
      setNotice({
        variant: 'fail',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    setNotice(null)

    try {
      await window.ipcRendererApi.invoke('github-auth-logout')
      setNotice({ variant: 'success', message: '已清除本地 GitHub 测试用户。' })
    } catch (error) {
      setNotice({
        variant: 'fail',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoggingOut(false)
      setLoggingIn(false)
    }
  }, [])

  const statusTitle = status?.authenticated
    ? '当前已登录'
    : status?.pending || loggingIn
      ? '等待 GitHub 授权回调…'
      : '未登录'

  const statusDescription = status?.authenticated
    ? '该用户数据仅用于桌面 OAuth 测试，不绑定业务权限。'
    : status?.pending || loggingIn
      ? '浏览器完成 GitHub 授权后，当前应用会自动刷新登录状态。'
      : '点击右侧按钮后，应用会打开 GitHub 授权页，并在回调成功后创建或更新本地测试用户。'

  return (
    <div className='mx-auto max-w-4xl px-6 py-12'>
      <header className='mb-8 flex items-center gap-4'>
        <div className='bg-primary/10 flex h-14 w-14 items-center justify-center rounded-2xl'>
          <CheckCircle2 className='text-primary h-7 w-7' />
        </div>
        <div>
          <h1 className='text-foreground text-3xl font-bold'>GitHub OAuth</h1>
        </div>
      </header>

      {notice ? (
        <div className='mb-6'>
          <Alert variant={notice.variant}>{notice.message}</Alert>
        </div>
      ) : null}

      {status === null ? (
        <section className='bg-card border-border flex flex-col items-center gap-4 rounded-3xl border p-10'>
          <LoaderCircle className='text-primary h-10 w-10 animate-spin' />
          <div className='text-foreground font-medium'>正在读取 GitHub 授权状态…</div>
        </section>
      ) : (
        <section className='border-border bg-primary/5 relative overflow-hidden rounded-3xl border p-8'>
          <div className='bg-primary/12 absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl' />
          <div className='relative space-y-6'>
            <div className='flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between'>
              <div className='max-w-2xl space-y-3'>
                <div className='space-y-1'>
                  <div className='text-text-secondary text-xs tracking-[0.2em] uppercase'>
                    GitHub OAuth
                  </div>
                  <h2 className='text-foreground text-2xl font-semibold'>{statusTitle}</h2>
                  <p className='text-text-secondary text-sm leading-6'>{statusDescription}</p>
                </div>

                {status.lastError ? <Alert variant='fail'>{status.lastError}</Alert> : null}
              </div>

              <div className='flex shrink-0 flex-wrap items-center gap-3'>
                <Button onClick={handleLogin} disabled={loggingOut} size='lg'>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loggingIn ? 'animate-spin' : ''}`} />
                  {loggingIn ? '重新打开授权页' : '登录 GitHub'}
                </Button>

                <Button
                  variant='outline'
                  onClick={handleLogout}
                  disabled={loggingOut || !status.authenticated}
                >
                  {loggingOut ? '退出中...' : '退出登录'}
                </Button>
              </div>
            </div>

            {status.authenticated && status.user ? (
              <div className='border-border/70 grid gap-6 border-t pt-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-center'>
                <div className='flex items-center gap-4'>
                  {status.user.avatarUrl ? (
                    <img
                      src={status.user.avatarUrl}
                      alt={status.user.username}
                      className='h-16 w-16 rounded-2xl object-cover ring-1 ring-black/10'
                      referrerPolicy='no-referrer'
                    />
                  ) : (
                    <div className='bg-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl'>
                      <CheckCircle2 className='text-primary h-8 w-8' />
                    </div>
                  )}

                  <div>
                    <div className='flex items-center gap-2'>
                      <CheckCircle2 className='h-5 w-5 text-emerald-500' />
                      <h3 className='text-foreground text-lg font-semibold'>
                        {status.user.username}
                      </h3>
                    </div>
                    <p className='text-text-secondary mt-1 text-sm'>
                      GitHub ID: {status.user.githubId}
                    </p>
                  </div>
                </div>

                <div className='border-border bg-background/60 grid gap-3 rounded-2xl border p-4 text-sm'>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-text-secondary'>Username</span>
                    <span className='text-foreground font-medium'>{status.user.username}</span>
                  </div>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-text-secondary'>GitHub ID</span>
                    <span className='text-foreground font-mono'>{status.user.githubId}</span>
                  </div>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='text-text-secondary'>Email</span>
                    <span className='text-foreground text-right'>
                      {status.user.email || 'GitHub 未返回邮箱'}
                    </span>
                  </div>
                </div>
              </div>
            ) : status.pending || loggingIn ? (
              <div className='border-border/70 flex items-center gap-4 border-t pt-6'>
                <LoaderCircle className='text-primary h-8 w-8 animate-spin' />
                <div>
                  <div className='text-foreground font-medium'>等待 GitHub 授权回调…</div>
                  <p className='text-text-secondary mt-1 text-sm leading-6'>
                    如果浏览器页面丢失了，直接点上面的“重新打开授权页”即可。
                  </p>
                </div>
              </div>
            ) : (
              <div className='border-border/70 flex items-start gap-3 border-t pt-6'>
                <RefreshCw className='text-primary mt-0.5 h-5 w-5' />
                <div>
                  <p className='text-text-secondary text-sm leading-6'>
                    当前没有本地 GitHub 测试用户。
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
