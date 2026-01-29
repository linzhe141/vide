import { memo, useState } from 'react'
import { Wrench, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { Button } from '../../ui/Button'
import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'
import { cn } from '../../lib/utils'
import type { ToolCall, ToolChatMessage } from '@/agent/core/types'
import { useChatContext } from './ChatProvider'

export const ToolCallItem = memo(function ToolCallItem({
  toolCall,
  isApproved,
  callId,
}: {
  toolCall: ToolCall & { result?: ToolChatMessage }
  isApproved: boolean
  callId: string
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { handleApprove, handleReject, isRunning } = useChatContext()
  function beautifyResult(content: string) {
    try {
      return JSON.parse(content as string)
    } catch (_e) {
      return content
    }
  }
  return (
    <div className=''>
      <div className='border-border bg-background/50 overflow-hidden rounded-xl border transition-all hover:shadow-md'>
        {/* 工具调用头部 */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className='hover:bg-border/30 flex w-full items-center gap-4 px-4 py-3 transition-colors'
        >
          {/* 左侧 Icon */}
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10'>
            <Wrench className='h-4 w-4 text-blue-600' />
          </div>

          {/* 中间：标题 + 描述 */}
          <div className='flex flex-1 flex-col text-left'>
            <span className='text-foreground text-sm leading-tight font-medium'>
              {toolCall.function?.name || 'Tool Call'}
            </span>
            <span className='text-text-secondary text-xs'>
              Click to {isExpanded ? 'collapse' : 'expand'} details
            </span>
          </div>

          {/* 右侧：审批状态 / 操作 */}
          {!isApproved && (
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

          {/* 右侧 Chevron */}
          <ChevronDown
            className={`text-text-secondary h-4 w-4 shrink-0 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>

        {/* 工具调用详情 */}
        {isExpanded && (
          <div>
            <div className='border-border bg-primary/5 border-t px-4 py-3'>
              <MarkdownRenderer
                className={cn(
                  'bg-background text-text-secondary overflow-auto rounded-lg font-mono text-xs'
                )}
                animation={isRunning}
              >
                {'```json\n' +
                  JSON.stringify({ id: toolCall.id, function: toolCall.function }, null, 2) +
                  '\n```'}
              </MarkdownRenderer>

              {toolCall.result && (
                <div className='border-border bg-background/50 mt-4 overflow-hidden rounded-xl border transition-all hover:shadow-md'>
                  {/* 工具结果头部 */}
                  <p className='hover:bg-border/30 flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors'>
                    Tool Result
                  </p>

                  {/* 工具结果详情 */}
                  {isExpanded && (
                    <div className='border-border border-t p-2'>
                      <MarkdownRenderer
                        className='bg-background text-text-secondary overflow-auto rounded-lg font-mono text-xs'
                        animation={isRunning}
                      >
                        {'```json\n' +
                          JSON.stringify(
                            beautifyResult(toolCall.result.content as string),
                            null,
                            2
                          ) +
                          '\n```'}
                      </MarkdownRenderer>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
