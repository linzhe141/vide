import { CheckCircle2, Bot } from 'lucide-react'
import { useChatContext } from './ChatProvider'
import { memo } from 'react'

// 状态提示组件
export const StatusIndicator = memo(function StatusIndicator() {
  const { isFinished } = useChatContext()

  if (!isFinished) return null

  return (
    <div className='flex justify-center py-4'>
      <div
        className={`transition-allbg-green-50 text-primary ring-primary/50 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium shadow-sm ring-1`}
      >
        <CheckCircle2 className='h-3.5 w-3.5' />
        <span>Completed</span>
      </div>
    </div>
  )
})

// 加载动画组件
export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className='ml-2 flex items-start gap-3'>
      <div className='flex gap-1.5'>
        <div
          className='bg-primary/90 h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '0ms' }}
        ></div>
        <div
          className='bg-primary/80 h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '150ms' }}
        ></div>
        <div
          className='bg-primary/70 h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '300ms' }}
        ></div>
      </div>
    </div>
  )
})

// 空状态组件
export const EmptyState = memo(function EmptyState() {
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
})
