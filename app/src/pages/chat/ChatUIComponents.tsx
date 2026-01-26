import { CheckCircle2, StopCircle, ArrowDown, Bot } from 'lucide-react'
import { useChatContext } from './ChatProvider'

// 状态提示组件
export function StatusIndicator() {
  const { isFinished, isAborted } = useChatContext()

  if (!isFinished && !isAborted) return null

  return (
    <div className='flex justify-center py-4'>
      <div
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium shadow-sm transition-all ${
          isFinished
            ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
            : 'bg-red-50 text-red-700 ring-1 ring-red-200'
        }`}
      >
        {isFinished ? (
          <>
            <CheckCircle2 className='h-3.5 w-3.5' />
            <span>Completed</span>
          </>
        ) : (
          <>
            <StopCircle className='h-3.5 w-3.5' />
            <span>Aborted</span>
          </>
        )}
      </div>
    </div>
  )
}

// 加载动画组件
export function TypingIndicator() {
  return (
    <div className='ml-12 flex items-start gap-3'>
      <div className='flex gap-1.5'>
        <div
          className='bg-text-secondary h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '0ms' }}
        ></div>
        <div
          className='bg-text-secondary h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '150ms' }}
        ></div>
        <div
          className='bg-text-secondary h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '300ms' }}
        ></div>
      </div>
    </div>
  )
}

// 滚动到底部按钮
export function ScrollToBottomButton() {
  const { toBottom } = useChatContext()

  return (
    <button
      onClick={toBottom}
      className='bg-background border-border hover:bg-primary/5 fixed bottom-32 left-1/2 -translate-x-1/2 rounded-full border p-3 shadow-lg transition-all hover:scale-105 hover:shadow-xl'
      aria-label='Scroll to bottom'
    >
      <ArrowDown size={18} className='text-foreground' />
    </button>
  )
}

// 空状态组件
export function EmptyState() {
  return (
    <div className='flex flex-col items-center justify-center gap-4 py-20 text-center'>
      <div className='bg-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl'>
        <Bot className='text-primary h-8 w-8' />
      </div>
      <div>
        <h3 className='text-foreground mb-1 text-lg font-semibold'>Start a conversation</h3>
        <p className='text-text-secondary text-sm'>Send a message to begin</p>
      </div>
    </div>
  )
}
