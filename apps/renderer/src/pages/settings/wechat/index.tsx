import { useCallback, useEffect, useState } from 'react'
import {
  MessageSquare,
  RefreshCw,
  LoaderCircle,
  CheckCircle2,
  LogOut,
  History,
} from 'lucide-react'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import type { WechatBotRuntimeStatus, WechatBotSessionRecord } from '@vide/config'

/**
 * 微信 Bot 设置页。
 *  - 已认证：显示“认证成功” + 运行状态 + 最近会话 + 退出登录。
 *  - 未认证 / 已过期：显示“获取二维码”按钮；点击后由后端 fetch 二维码并用默认浏览器打开，
 *    期间显示 loading，认证成功时由 wechat-sessions-changed 事件关闭 loading 并切换为“认证成功”。
 *  全部通过 IPC 通信完成，无前端轮询。
 */
export function WechatBotSettings() {
  const [loading, setLoading] = useState(false)
  const [runtime, setRuntime] = useState<WechatBotRuntimeStatus | null>(null)
  const [sessions, setSessions] = useState<WechatBotSessionRecord[]>([])
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null)

  const refreshRuntime = useCallback(async () => {
    try {
      const status = await window.ipcRendererApi.invoke('wechat-get-runtime-status')
      setRuntime(status)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    refreshRuntime()
    void window.ipcRendererApi.invoke('wechat-get-recent-sessions').then(setSessions).catch(() => {})

    const dispose = window.ipcRendererApi.on(
      'wechat-sessions-changed',
      (data: {
        activeSessionId: string | null
        sessions: WechatBotSessionRecord[]
        status: WechatBotRuntimeStatus
      }) => {
        setSessions(data.sessions ?? [])
        setRuntime(data.status ?? null)
        if (data.status?.authenticated) {
          setLoading(false)
          setNotice({ success: true, message: '认证成功，Bot 已连接。' })
        }
      }
    )
    return () => dispose()
  }, [])

  const handleGetQR = async () => {
    setLoading(true)
    setNotice(null)
    try {
      await window.ipcRendererApi.invoke('wechat-get-qrcode')
      setNotice({ success: true, message: '已在默认浏览器打开微信登录二维码，请扫码确认。' })
    } catch (err) {
      setLoading(false)
      setNotice({ success: false, message: String((err as Error)?.message ?? err) })
    }
    // 认证成功由 wechat-sessions-changed 事件通知，此处不轮询
  }

  const handleLogout = async () => {
    await window.ipcRendererApi.invoke('wechat-logout')
    setLoading(false)
    setSessions([])
    setNotice({ success: true, message: '已退出登录。' })
    await refreshRuntime()
  }

  const authenticated = runtime?.authenticated ?? false

  return (
    <div className='mx-auto max-w-3xl px-6 py-12'>
      <div className='mb-8 flex items-center gap-3'>
        <div className='bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl'>
          <MessageSquare className='text-primary h-6 w-6' />
        </div>
        <div>
          <h1 className='text-foreground text-3xl font-bold'>WeChat Bot</h1>
          <p className='text-muted-foreground'>
            Connect your WeChat to the agent (official iLink HTTP API, no extra packages)
          </p>
        </div>
      </div>

      {notice && (
        <div className='mb-6'>
          <Alert variant={notice.success ? 'success' : 'fail'}>{notice.message}</Alert>
        </div>
      )}

      {/* 认证区 */}
      {authenticated ? (
        <section className='bg-card border-border rounded-2xl border p-8'>
          <div className='flex items-center gap-3'>
            <CheckCircle2 className='h-8 w-8 text-emerald-500' />
            <div>
              <h2 className='text-foreground text-lg font-semibold'>认证成功</h2>
              <p className='text-text-secondary text-sm'>
                Bot 已登录并连接 agent{runtime?.connected ? '，正在监听微信消息。' : '。'}
              </p>
            </div>
          </div>

          {runtime?.connected && (
            <div className='mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4'>
              <Stat label='Listening' value='On' active />
              <Stat label='Messages' value={String(runtime.messageCount ?? 0)} />
              <Stat
                label='Last message'
                value={
                  runtime.lastMessageAt
                    ? new Date(runtime.lastMessageAt).toLocaleTimeString()
                    : '—'
                }
              />
              <Stat
                label='Active session'
                value={runtime.activeSessionId ? runtime.activeSessionId.slice(0, 8) : '—'}
              />
            </div>
          )}

          {runtime?.lastError && (
            <div className='mt-4'>
              <Alert variant='warn'>lastError：{runtime.lastError}</Alert>
            </div>
          )}

          <div className='mt-6 flex items-center gap-3'>
            <Button variant='outline' onClick={handleLogout}>
              <LogOut className='mr-1 h-4 w-4' />
              退出登录
            </Button>
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

          <div className='border-border bg-background mt-6 rounded-lg border p-3'>
            <div className='text-foreground mb-1 text-xs font-semibold uppercase tracking-wide'>
              可用指令
            </div>
            <ul className='space-y-0.5 text-xs'>
              <li><code>recently sessions</code> / <code>/sessions</code> — 最近会话列表</li>
              <li><code>new session</code> / <code>/new</code> — 新建并切换会话</li>
              <li><code>switch &lt;id&gt;</code> — 切换到指定会话</li>
              <li><code>help</code> — 帮助</li>
            </ul>
          </div>
        </section>
      )}

      {/* 最近会话 */}
      {authenticated && (
        <section className='bg-card border-border mt-8 rounded-2xl border p-8'>
          <div className='mb-4 flex items-center gap-2'>
            <History className='text-primary h-5 w-5' />
            <h2 className='text-foreground text-lg font-semibold'>Recent sessions ({sessions.length})</h2>
          </div>
          {sessions.length === 0 ? (
            <p className='text-text-info text-sm'>
              还没有会话。在微信里发送 <code>new session</code> 创建。
            </p>
          ) : (
            <ul className='border-border divide-border bg-background divide-y rounded-lg border'>
              {sessions.map((s) => {
                const active = runtime?.activeSessionId === s.sessionId
                return (
                  <li key={s.sessionId} className='flex items-center justify-between px-3 py-2 text-sm'>
                    <div className='flex items-center gap-2'>
                      <span className='text-foreground font-mono'>{s.sessionId.slice(0, 8)}</span>
                      {active && (
                        <span className='bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[11px]'>
                          当前
                        </span>
                      )}
                    </div>
                    <div className='text-text-secondary text-xs'>
                      {new Date(s.lastUsedAt).toLocaleString()}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className='border-border bg-background rounded-lg border p-3'>
      <div className='text-text-secondary text-xs'>{label}</div>
      <div className={`mt-0.5 font-medium ${active ? 'text-emerald-500' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  )
}
