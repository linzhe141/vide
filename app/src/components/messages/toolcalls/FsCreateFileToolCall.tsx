import { memo, useState } from 'react'
import { Wrench, CheckCircle2, XCircle, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '../../../ui/Button'
import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'
import { cn } from '../../../lib/utils'
import type { ToolCall } from '@/agent/core/types'
import { useChatContext } from '../../../pages/chat/ChatProvider'

export const FsCreateFileToolCall = memo(function FsCreateFileToolCall({
  toolCall,
  callId,
  animation,
}: {
  toolCall: ToolCall & { result?: string }
  callId: string
  animation: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { handleApprove, handleReject } = useChatContext()

  function beautifyResult(content: string) {
    try {
      return JSON.parse(content)
    } catch {
      return content
    }
  }

  const isApproved = !!toolCall.result

  // ⭐ 只有 fs_create_file 才有 streaming loading
  let updating = true
  try {
    if (JSON.parse(toolCall.function.arguments)) {
      updating = false
    }
  } catch {
    updating = true
  }

  return (
    <div>
      <div className='border-border bg-background/50 overflow-hidden rounded-xl border transition-all'>
        {/* Header */}
        <div
          onClick={() => !updating && setIsExpanded(!isExpanded)}
          className='hover:bg-border/30 flex w-full items-center gap-4 px-4 py-3 transition-colors'
        >
          {/* Icon */}
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10'>
            <Wrench className='h-4 w-4 text-blue-600' />
          </div>

          {/* Title */}
          {updating ? (
            <div className='flex flex-1 gap-4 text-left'>
              <span className='text-foreground text-sm font-medium'>{toolCall.function?.name}</span>
              <Loader2 className='h-4 w-4 animate-spin text-gray-500' />
            </div>
          ) : (
            <div className='flex flex-1 flex-col text-left'>
              <span className='text-foreground text-sm font-medium'>{toolCall.function?.name}</span>
              <span className='text-text-secondary text-xs'>
                Click to {isExpanded ? 'collapse' : 'expand'} details
              </span>
            </div>
          )}

          {/* Approve */}
          {!updating && !isApproved && (
            <div className='flex items-center gap-2' onClick={(e) => e.stopPropagation()}>
              <div className='flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-1'>
                <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500' />
                <span className='text-text-secondary text-xs font-medium'>Approval Required</span>
              </div>

              <Button
                onClick={() => handleApprove(callId)}
                size='sm'
                className='flex items-center gap-1.5 text-xs'
              >
                <CheckCircle2 className='h-3.5 w-3.5' />
                Approve
              </Button>

              <Button
                onClick={handleReject}
                size='sm'
                variant='outline'
                className='flex items-center gap-1.5 text-xs'
              >
                <XCircle className='h-3.5 w-3.5' />
                Reject
              </Button>
            </div>
          )}

          {!updating && (
            <ChevronDown
              className={cn(
                'text-text-secondary h-4 w-4 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          )}
        </div>

        {/* Detail */}
        {!updating && isExpanded && (
          <div className='border-border bg-primary/5 border-t px-4 py-3'>
            <MarkdownRenderer
              className='bg-background text-text-secondary overflow-auto rounded-lg font-mono text-xs'
              animation={animation}
            >
              {'```json\n' +
                JSON.stringify({ id: toolCall.id, function: toolCall.function }, null, 2) +
                '\n```'}
            </MarkdownRenderer>

            {toolCall.result && (
              <div className='text-text-secondary my-2 space-y-1 text-sm'>
                <div>{beautifyResult(toolCall.result).message}</div>
                <div>{beautifyResult(toolCall.result).fullPath}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
