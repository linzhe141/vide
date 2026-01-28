import { memo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'
import { useChatContext } from './ChatProvider'

export const ToolMessage = memo(function ToolMessage({ content }: { content: any }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { isRunning } = useChatContext()

  return (
    <div className='flex items-start gap-3'>
      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10'>
        <CheckCircle2 className='h-4 w-4 text-green-600' />
      </div>
      <div className='max-w-3xl flex-1'>
        <div className='border-border bg-background/50 overflow-hidden rounded-xl border transition-all hover:shadow-md'>
          {/* 工具结果头部 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className='hover:bg-border/30 flex w-full items-center gap-3 px-4 py-3 transition-colors'
          >
            <div className='flex-1 text-left'>
              <p className='text-foreground text-sm font-medium'>Tool Result</p>
              <p className='text-text-secondary text-xs'>
                Click to {isExpanded ? 'collapse' : 'expand'} details
              </p>
            </div>
            <svg
              className={`text-text-secondary h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
            </svg>
          </button>

          {/* 工具结果详情 */}
          {isExpanded && (
            <div className='border-border border-t bg-green-500/5 px-4 py-3'>
              <MarkdownRenderer
                className='bg-background text-text-secondary overflow-auto rounded-lg p-3 font-mono text-xs'
                animation={isRunning}
              >
                {'```json\n' + JSON.stringify(content, null, 2) + '\n```'}
              </MarkdownRenderer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
