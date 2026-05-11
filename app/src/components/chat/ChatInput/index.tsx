import { useThreadPlanners } from '@/app/src/store/threadStore'
import { Send } from 'lucide-react'
import { useState, useRef, useEffect, memo } from 'react'
import { Planner } from '../PlannersDisplay'
import { Textarea } from '@/app/src/ui/Textarea'
import { Button } from '@/app/src/ui/Button'
import { useChatContext } from '../ChatProvider'

export const ChatInput = memo(function ChatInput({ onSend }: { onSend: (input: string) => void }) {
  const { threadId } = useChatContext()

  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const planners = useThreadPlanners(threadId)
  const pendingPlanner = planners?.find((i) => i.plan.some((i) => i.status !== 'completed'))
  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (input.trim()) {
      onSend(input)
      setInput('')
    }
  }

  return (
    <div>
      <div className='mx-auto max-w-5xl px-4 py-4'>
        {pendingPlanner && (
          <div className='flex justify-center'>
            <div className='border-border w-9/10 rounded-xl rounded-ee-none rounded-es-none border border-b-0 py-3'>
              <Planner planner={pendingPlanner} />
            </div>
          </div>
        )}

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
            disabled={false}
            className='text-foreground placeholder:text-text-info w-full resize-none rounded-2xl border-0 bg-transparent px-4 pt-4 pb-12 focus:ring-0 focus:outline-none disabled:opacity-50'
            rows={1}
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />

          {/* 按钮区域 - 绝对定位在右下角 */}
          <div className='absolute right-3 bottom-3 flex items-center gap-2'>
            {/* {(window.x = 1) ? (
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
            )} */}
            <Button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className='bg-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
            >
              <Send className='h-4 w-4' />
              <span>Send</span>
            </Button>
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
