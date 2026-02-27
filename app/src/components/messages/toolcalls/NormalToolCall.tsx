import { memo, useMemo, useState } from 'react'
import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'
import { cn } from '../../../lib/utils'
import type { ToolCall } from '@/agent/core/types'
import { BaseToolCallLayout } from './BaseToolCallLayout'

export const NormalToolCall = memo(
  ({
    toolCall,
    animation,
    showApproveOperate,
  }: {
    toolCall: ToolCall & { result?: string; status: 'pending' | 'approve' | 'reject' }
    animation: boolean
    showApproveOperate: boolean
  }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    const toolCallResult = useMemo(() => {
      if (!toolCall.result) return {}
      try {
        return JSON.parse(toolCall.result)
      } catch {
        return toolCall.result
      }
    }, [toolCall.result])

    return (
      <BaseToolCallLayout
        toolCall={toolCall}
        animation={animation}
        showApproveOperate={showApproveOperate}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      >
        <MarkdownRenderer
          className={cn(
            'bg-background text-text-secondary overflow-auto rounded-lg font-mono text-xs'
          )}
          animation={animation}
        >
          {'```json\n' +
            JSON.stringify({ id: toolCall.id, function: toolCall.function }, null, 2) +
            '\n```'}
        </MarkdownRenderer>

        {toolCall.result && (
          <div className='border-border bg-background/50 mt-4 overflow-hidden rounded-xl border transition-all'>
            <p className='hover:bg-border/30 flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors'>
              Tool Result
            </p>

            <div className='border-border border-t p-2'>
              <MarkdownRenderer
                className='bg-background text-text-secondary overflow-auto rounded-lg font-mono text-xs'
                animation={animation}
              >
                {'```json\n' + JSON.stringify(toolCallResult, null, 2) + '\n```'}
              </MarkdownRenderer>
            </div>
          </div>
        )}
      </BaseToolCallLayout>
    )
  }
)

NormalToolCall.displayName = 'NormalToolCall'

