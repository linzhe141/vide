import { useCallback, useEffect, useState } from 'react'
import { MessageSquare, RefreshCw, LoaderCircle, CheckCircle2 } from 'lucide-react'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'

export function WechatBotSettings() {
  const [loading, setLoading] = useState(false)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    let disposed = false

    void window.ipcRendererApi.invoke('wechat-get-runtime-status').then((status) => {
      if (disposed) return
      setAuthenticated(status.authenticated)
    })

    const remove = window.ipcRendererApi.on('weixin-bot-auth-success', () => {
      setLoading(false)
      setAuthenticated(true)
      setNotice({ success: true, message: '认证成功，Bot 已完成登录认证。' })
    })

    return () => {
      disposed = true
      remove()
    }
  }, [])

  const handleGetQR = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      await window.ipcRendererApi.invoke('wechat-get-qrcode')
      setNotice({
        success: true,
        message: '已用默认浏览器打开微信登录二维码，请在新窗口扫码确认。',
      })
    } catch (err) {
      setLoading(false)
      setNotice({ success: false, message: String((err as Error)?.message ?? err) })
    }
    // 认证成功由 weixin-bot-auth-success 事件通知，此处不轮询
  }, [])

  return (
    <div className='mx-auto max-w-3xl px-6 py-12'>
      <div className='mb-8 flex items-center gap-3'>
        <div className='bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl'>
          <MessageSquare className='text-primary h-6 w-6' />
        </div>
        <div>
          <h1 className='text-foreground text-3xl font-bold'>WeChat Bot</h1>
        </div>
      </div>

      {notice && (
        <div className='mb-6'>
          <Alert variant={notice.success ? 'success' : 'fail'}>{notice.message}</Alert>
        </div>
      )}

      {authenticated === null ? (
        <section className='bg-card border-border flex flex-col items-center gap-4 rounded-2xl border p-10'>
          <LoaderCircle className='text-primary h-10 w-10 animate-spin' />
          <div className='text-foreground font-medium'>正在检查认证状态…</div>
        </section>
      ) : authenticated ? (
        <section className='bg-card border-border rounded-2xl border p-8'>
          <div className='flex items-center gap-3'>
            <CheckCircle2 className='h-8 w-8 text-emerald-500' />
            <div>
              <h2 className='text-foreground text-lg font-semibold'>认证成功</h2>
              <p className='text-text-secondary text-sm'>微信 Bot 已完成登录认证。</p>
            </div>
          </div>
        </section>
      ) : loading ? (
        <section className='bg-card border-border flex flex-col items-center gap-4 rounded-2xl border p-10'>
          <LoaderCircle className='text-primary h-10 w-10 animate-spin' />
          <div className='text-foreground font-medium'>等待扫码确认…</div>
          <p className='text-text-secondary text-sm'>
            已在默认浏览器打开登录二维码，扫码并确认后将自动完成认证。
          </p>
          <Button variant='ghost' size='sm' onClick={() => setLoading(false)}>
            取消
          </Button>
        </section>
      ) : (
        <section className='bg-card border-border rounded-2xl border p-8'>
          <div className='mb-6 flex items-center gap-2'>
            <RefreshCw className='text-primary h-5 w-5' />
            <h2 className='text-foreground text-lg font-semibold'>微信登录</h2>
          </div>

          <p className='text-text-secondary mb-6 text-sm'>
            点击下方按钮，将使用你的默认浏览器打开微信登录二维码。扫码确认后本页会自动显示「认证成功」。
          </p>

          <Button onClick={handleGetQR}>
            <RefreshCw className='mr-1 h-4 w-4' />
            获取二维码
          </Button>
        </section>
      )}
    </div>
  )
}
