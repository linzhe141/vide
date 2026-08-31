import { memo, useState } from 'react'
import type { ToolCallState } from '@/store/sessionStore/types'
import type { ToolCall } from '@vide/ai'
import { useSubAgentWorkflow } from '@/store/sessionStore'
import { useChatContext } from '@/hooks/useChatContext'

import { MessageView } from '../../MessageView'
import { Bot, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

export const SubAgentToolCall = memo(function SubAgentToolCall({
  workflowId,
  toolCallState,
}: {
  workflowId: string
  toolCallState: ToolCallState
}) {
  const { sessionId } = useChatContext()
  const [isExpanded, setIsExpanded] = useState(true)
  const toolCall: ToolCall = toolCallState.toolCall
  const result = toolCallState.result
  const duration = formatDuration(result?.durationMs)
  const subAgentWorkflow = useSubAgentWorkflow(sessionId, workflowId, toolCall.id)
  if (!subAgentWorkflow) return null

  const hasContent = subAgentWorkflow.messages.some((i) => i.role !== 'user')
  const isComplete = result?.status === 'success'
  const agentName = JSON.parse(toolCall.function?.arguments).agentName || 'Tool'

  return (
    <div className='border-border/50 bg-background/50 my-4 rounded-lg border shadow-sm transition-shadow hover:shadow-md'>
      <button
        type='button'
        aria-expanded={isExpanded}
        className='border-border/30 sticky top-0 z-10 flex w-full items-center justify-between rounded-t-lg border-b bg-[#ebf1f8] px-4 py-3 text-left transition-colors dark:bg-[#030910]'
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className='flex min-w-0 items-center gap-3'>
          <div className='bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full'>
            <Bot className='h-4 w-4' aria-hidden='true' />
          </div>
          <div className='flex min-w-0 flex-col'>
            <div className='flex items-center gap-2'>
              <span className='truncate text-sm font-semibold'>Sub-Agent</span>
              <span className='bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium'>
                {agentName}
              </span>
              {isComplete && (
                <span className='bg-success/10 text-success rounded-full px-2 py-0.5 text-xs font-medium'>
                  Complete
                </span>
              )}
            </div>
            {duration && (
              <div className='text-text-secondary flex items-center gap-1 text-xs'>
                <Clock className='h-3 w-3' aria-hidden='true' />
                <span>{duration}</span>
              </div>
            )}
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-2'>
          {!isComplete && (
            <Loader2 className='text-primary h-4 w-4 animate-spin' aria-hidden='true' />
          )}
          {isExpanded ? (
            <ChevronUp className='text-text-secondary h-4 w-4' aria-hidden='true' />
          ) : (
            <ChevronDown className='text-text-secondary h-4 w-4' aria-hidden='true' />
          )}
        </div>
      </button>

      {isExpanded && hasContent && (
        <div className='bg-background/30 space-y-3 px-4 py-3'>
          <div className='relative'>
            <div className='space-y-3'>
              {subAgentWorkflow.messages
                .filter((i) => i.role !== 'user')
                .map((message) => {
                  return (
                    <div key={message.id} className='relative'>
                      <MessageView
                        message={message}
                        workflowId={subAgentWorkflow.id}
                        workflowStatus={subAgentWorkflow.runtime.status}
                      />
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

function formatDuration(durationMs?: number) {
  if (!durationMs) return null
  if (durationMs < 1000) return `${durationMs}ms`

  const seconds = durationMs / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`

  return `${Math.round(seconds)}s`
}
