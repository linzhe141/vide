import { useEffect, useState } from 'react'
import { ArrowRightLeft, MessageSquare, Monitor, PanelsTopLeft } from 'lucide-react'
import { Button } from '@/ui/Button'

type DemoWindowRole = 'main' | 'foo'

type MultiWindowDemoMessage = {
  source: DemoWindowRole
  target: DemoWindowRole
  message: string
  sentAt: string
}

export function MultiWindowDemoPage() {
  const [messages, setMessages] = useState<MultiWindowDemoMessage[]>([])
  const [hasOpenedFoo, setHasOpenedFoo] = useState(false)

  useEffect(() => {
    return window.ipcRendererApi.on('multi-window-demo-message', (payload) => {
      if (payload.source !== 'main' && payload.target !== 'main') return
      setMessages((current) => [payload, ...current].slice(0, 30))
    })
  }, [])

  const handleOpenFoo = () => {
    setHasOpenedFoo(true)
    window.ipcRendererApi.invoke('open-multi-window-demo')
  }

  const handleSendToFoo = () => {
    if (!hasOpenedFoo) return
    window.ipcRendererApi.invoke('multi-window-demo-send', {
      source: 'main',
      target: 'foo',
      message: 'main 点击了',
    })
  }

  return (
    <div className='h-full overflow-auto'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-8'>
        <header className='flex flex-col gap-3'>
          <div className='flex items-center gap-2 text-2xl font-semibold'>
            <PanelsTopLeft className='text-primary size-5' />
            Multi-window IPC Demo
          </div>
          <p className='text-text-secondary max-w-2xl text-sm'>
            This page is the main-side demo panel. Open the foo child window here, then use the
            buttons below to send IPC messages and watch both sides update their UI.
          </p>
        </header>

        <section className='border-border bg-background/80 grid gap-4 rounded-2xl border p-6 shadow-sm backdrop-blur md:grid-cols-[1.4fr_1fr]'>
          <div className='space-y-4'>
            <div>
              <div className='text-foreground font-medium'>Main actions</div>
              <div className='text-text-secondary mt-1 text-sm'>
                First show the foo child window, then send a message from main to foo.
              </div>
            </div>

            <div className='flex flex-wrap gap-3'>
              <Button className='gap-2' onClick={handleOpenFoo}>
                <Monitor className='size-4' />
                显示 foo 子窗口
              </Button>
              <Button
                variant='outline'
                className='gap-2'
                onClick={handleSendToFoo}
                disabled={!hasOpenedFoo}
              >
                <ArrowRightLeft className='size-4' />
                向子窗口通信
              </Button>
            </div>
          </div>

          <div className='border-border rounded-xl border p-4'>
            <div className='text-foreground flex items-center gap-2 font-medium'>
              <MessageSquare className='size-4' />
              Status
            </div>
            <div className='text-text-secondary mt-2 text-sm'>
              {hasOpenedFoo
                ? 'Foo window has been opened. Click the second button to send main -> foo.'
                : 'Foo window is not open yet.'}
            </div>
          </div>
        </section>

        <section className='border-border bg-background/80 rounded-2xl border p-6 shadow-sm backdrop-blur'>
          <div className='mb-4 flex items-center justify-between gap-3'>
            <div>
              <div className='text-foreground font-medium'>IPC message list</div>
              <div className='text-text-secondary mt-1 text-sm'>
                Incoming messages from foo and echoed main to foo messages appear here.
              </div>
            </div>
            <Button variant='ghost' size='sm' onClick={() => setMessages([])}>
              Clear
            </Button>
          </div>

          <div className='space-y-3'>
            {messages.length > 0 ? (
              messages.map((message, index) => (
                <div
                  key={`${message.sentAt}-${message.source}-${index}`}
                  className='border-border rounded-xl border p-4'
                >
                  <div className='text-text-secondary mb-1 text-xs'>
                    {formatTime(message.sentAt)} · {message.source} -&gt; {message.target}
                  </div>
                  <div className='text-foreground text-sm'>{message.message}</div>
                </div>
              ))
            ) : (
              <div className='border-border text-text-secondary rounded-xl border border-dashed p-6 text-sm'>
                No IPC messages yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString()
}
