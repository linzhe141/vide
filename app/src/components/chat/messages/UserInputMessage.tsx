import type { UserInputSessionMessage } from '@/app/src/store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

export function UserInputMessage({ message }: { message: UserInputSessionMessage }) {
  return (
    <div className='group flex justify-end px-3 py-2'>
      <div className='max-w-[min(78%,720px)] space-y-2'>
        <div
          className={`border-border/60 bg-foreground/[0.03] group-hover:border-border relative overflow-hidden rounded-[26px] rounded-br-md border px-5 py-3.5 text-[15px] leading-7 shadow-sm backdrop-blur-xl transition-all duration-200 group-hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.045]`}
        >
          {/* subtle gradient */}
          <div
            className='pointer-events-none absolute inset-0 opacity-60'
            style={{
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.03), transparent)',
            }}
          />

          <MarkdownRenderer animation={false} className='relative z-10 text-inherit'>
            {message.content}
          </MarkdownRenderer>
        </div>

        <div className='flex justify-end pr-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
          <UserInputMessageActions message={message} />
        </div>
      </div>
    </div>
  )
}

function UserInputMessageActions({ message }: { message: UserInputSessionMessage }) {
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopySuccess(true)
  }

  useEffect(() => {
    if (!copySuccess) return

    const timer = setTimeout(() => {
      setCopySuccess(false)
    }, 1800)

    return () => clearTimeout(timer)
  }, [copySuccess])

  return (
    <button
      type='button'
      onClick={handleCopy}
      className={`text-text-secondary hover:border-border hover:bg-foreground/[0.04] hover:text-foreground flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1.5 transition-all duration-200 active:scale-95`}
    >
      <div className='flex items-center justify-center'>
        {copySuccess ? (
          <Check size={13} className='text-green-500' strokeWidth={2.5} />
        ) : (
          <Copy size={13} strokeWidth={2.3} />
        )}
      </div>

      <span className='text-[11px] font-medium'>{copySuccess ? 'Copied' : 'Copy'}</span>
    </button>
  )
}
