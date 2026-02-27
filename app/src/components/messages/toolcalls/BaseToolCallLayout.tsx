import { memo, ReactNode } from 'react'
import { Wrench, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { Button } from '../../../ui/Button'
import { cn } from '../../../lib/utils'
import type { ToolCall } from '@/agent/core/types'
import { useChatContext } from '../../../pages/chat/ChatProvider'

interface BaseToolCallLayoutProps {
  toolCall: ToolCall & { result?: string; status: 'pending' | 'approve' | 'reject' }
  animation: boolean
  showApproveOperate: boolean
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
  showChevron?: boolean
  isUpdating?: boolean
}

export const BaseToolCallLayout = memo(
  ({
    toolCall,
    showApproveOperate,
    isExpanded,
    onToggle,
    children,
    showChevron = true,
    isUpdating = false,
  }: BaseToolCallLayoutProps) => {
    const { handleApprove, handleReject } = useChatContext()

    return (
      <div className='border-border bg-background/50 relative rounded-xl border transition-all'>
        {/* Header */}
        <div
          onClick={onToggle}
          className='bg-background sticky top-0 z-10 flex w-full items-center gap-4 rounded-xl px-4 py-3 transition-colors'
        >
          {/* Icon */}
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10'>
            <Wrench className='h-4 w-4 text-blue-600' />
          </div>

          {/* Title */}
          <div className='flex flex-1 flex-col text-left'>
            <span className='text-foreground text-sm font-medium'>
              {toolCall.function?.name || 'Tool Call'}
            </span>
            <span className='text-text-secondary text-xs'>
              Click to {isExpanded ? 'collapse' : 'expand'} details
            </span>
          </div>

          {/* Approve Buttons */}
          {!isUpdating && showApproveOperate && (
            <div className='flex items-center gap-2' onClick={(e) => e.stopPropagation()}>
              <div className='flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-1'>
                <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500' />
                <span className='text-text-secondary text-xs font-medium'>Approval Required</span>
              </div>

              <Button
                onClick={() => handleApprove(toolCall.id)}
                size='sm'
                className='flex items-center gap-1.5 text-xs'
              >
                <CheckCircle2 className='h-3.5 w-3.5' />
                Approve
              </Button>

              <Button
                onClick={() => handleReject(toolCall.id)}
                size='sm'
                variant='outline'
                className='flex items-center gap-1.5 text-xs'
              >
                <XCircle className='h-3.5 w-3.5' />
                Reject
              </Button>
            </div>
          )}

          {/* Chevron */}
          {!isUpdating && showChevron && (
            <ChevronDown
              className={cn(
                'text-text-secondary h-4 w-4 shrink-0 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          )}
        </div>

        {/* Detail */}
        {isExpanded && (
          <div className='border-border bg-primary/5 border-t px-4 py-3'>{children}</div>
        )}
      </div>
    )
  }
)

BaseToolCallLayout.displayName = 'BaseToolCallLayout'
