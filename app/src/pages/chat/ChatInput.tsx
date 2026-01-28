import { Send, StopCircle } from 'lucide-react'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { useChatContext } from './ChatProvider'
import { memo, useState } from 'react'

export const ChatInput = memo(function ChatInput() {
  const [input, setInput] = useState('')

  const { handleSend, isRunning } = useChatContext()

  return (
    <div className='border-border bg-background/80 border-t backdrop-blur-sm'>
      <div className='mx-auto max-w-4xl px-4 py-4'>
        <div className='relative'>
          {/* 渐变边框效果 */}
          <div className='from-primary/20 via-primary/10 to-primary/20 absolute -inset-0.5 rounded-2xl bg-gradient-to-r opacity-20 blur'></div>

          <div className='relative flex items-end gap-2'>
            <div className='relative flex-1'>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Type your message...'
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(input)
                    setInput('')
                  }
                }}
                disabled={isRunning}
                className='border-border focus:border-primary/50 resize-none rounded-xl pr-12 transition-all'
              />
            </div>

            {isRunning ? (
              <Button
                onClick={() => {}}
                className='border-border bg-background text-foreground flex h-10 shrink-0 items-center gap-2 rounded-xl border px-4 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600'
              >
                <StopCircle className='h-4 w-4' />
                <span className='hidden sm:inline'>Stop</span>
              </Button>
            ) : (
              <Button
                onClick={() => {
                  handleSend(input)
                  setInput('')
                }}
                disabled={!input.trim()}
                className='flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100'
              >
                <Send className='h-4 w-4' />
                <span className='hidden sm:inline'>Send</span>
              </Button>
            )}
          </div>
        </div>

        {/* 快捷提示 */}
        <p className='text-text-info mt-2 text-center text-xs'>
          Press <kbd className='bg-border/50 rounded px-1.5 py-0.5 font-mono'>Enter</kbd> to send,{' '}
          <kbd className='bg-border/50 rounded px-1.5 py-0.5 font-mono'>Shift + Enter</kbd> for new
          line
        </p>
      </div>
    </div>
  )
})
