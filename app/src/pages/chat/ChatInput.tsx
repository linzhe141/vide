import { Send, StopCircle } from 'lucide-react'
import { Textarea } from '../../ui/Textarea'
import { Button } from '../../ui/Button'
import { useChatContext } from './ChatProvider'
import { memo, useState, useRef, useEffect } from 'react'

export const ChatInput = memo(function ChatInput() {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { handleSend, isRunning } = useChatContext()

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (input.trim() && !isRunning) {
      handleSend(input)
      setInput('')
    }
  }

  return (
    <div>
      <div className='mx-auto max-w-5xl px-4 py-4'>
        <div className='border-border bg-background focus-within:border-primary focus-within:ring-primary/10 relative rounded-2xl border shadow-sm transition-all focus-within:ring-2'>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            disabled={isRunning}
            className='text-foreground placeholder:text-text-info w-full resize-none rounded-2xl border-0 bg-transparent px-4 pt-4 pb-12 focus:ring-0 focus:outline-none disabled:opacity-50'
            rows={1}
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />

          {/* 按钮区域 - 绝对定位在右下角 */}
          <div className='absolute right-3 bottom-3 flex items-center gap-2'>
            {isRunning ? (
              <Button
                onClick={() => {}}
                className='border-border bg-background text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-700 dark:hover:bg-red-950/30'
              >
                <StopCircle className='h-4 w-4' />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className='bg-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
              >
                <Send className='h-4 w-4' />
                <span>Send</span>
              </Button>
            )}
          </div>
        </div>

        <p className='text-text-info mt-2 text-center text-xs'>
          <kbd className='bg-border/50 rounded px-1.5 py-0.5 font-mono text-[10px]'>Enter</kbd> to
          send,{' '}
          <kbd className='bg-border/50 rounded px-1.5 py-0.5 font-mono text-[10px]'>
            Shift+Enter
          </kbd>{' '}
          for new line
        </p>
      </div>
    </div>
  )
})
