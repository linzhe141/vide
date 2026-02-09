import { BrainCircuit, Loader2, ChevronDown } from 'lucide-react'
import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'
import { cn } from '../../lib/utils'
import { useEffect, useState } from 'react'

export function AssistantReasonMessage({
  content,
  reasoning,
}: {
  content: string
  reasoning: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(reasoning)

  // 当 reasoning 状态变化时自动控制展开
  useEffect(() => {
    if (reasoning) {
      setIsExpanded(true)
    }
  }, [reasoning])

  return (
    <div className='w-full'>
      <div
        className={cn(
          'relative w-full rounded-2xl border px-4 py-3 shadow-sm',
          'bg-background border-border'
        )}
      >
        {/* Header (Clickable) */}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className={cn(
            'text-text-info mb-2 flex w-full items-center justify-between',
            'hover:text-foreground text-[11px] transition-colors'
          )}
        >
          <div className='flex items-center gap-2'>
            {reasoning ? (
              <Loader2 className='text-primary h-3.5 w-3.5 animate-spin' />
            ) : (
              <BrainCircuit className='text-primary h-3.5 w-3.5' />
            )}

            <span className='font-medium tracking-wide'>
              {reasoning ? 'Reasoning…' : 'Reasoning'}
            </span>
          </div>

          {/* Chevron */}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        </button>

        {/* Collapsible Content */}
        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className='overflow-hidden'>
            {/* Divider */}
            <div className='bg-border mb-3 h-px w-full' />

            {/* Markdown */}
            <MarkdownRenderer
              className={cn('font-sans text-xs leading-relaxed', 'text-text-secondary')}
              animation={reasoning}
            >
              {content}
            </MarkdownRenderer>
          </div>
        </div>

        {/* Streaming gradient mask */}
        {reasoning && isExpanded && (
          <div className='to-background/70 pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-transparent via-transparent' />
        )}
      </div>
    </div>
  )
}
