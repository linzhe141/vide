import type { Workflow } from '@/store/sessionStore/types'
import type { ToolCall } from '@vide/ai'

import { findToolResult } from '.'
import { MessageView } from '../../MessageView'
import { Bot, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useState } from 'react'

export function SubAgentToolCall({
  workflow,
  toolCall,
}: {
  workflow: Workflow
  toolCall: ToolCall
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const result = findToolResult(workflow, toolCall.id)
  const duration = formatDuration(result?.durationMs)
  const toolCallMessageIndex = workflow.messages.findIndex(
    (i) => i.role === 'tool-call' && i.toolCalls.some((t) => t.id === toolCall.id)
  )

  let subAgentWorkflow: Workflow | undefined
  for (let i = toolCallMessageIndex; i < workflow.messages.length; i++) {
    const message = workflow.messages[i]
    if (message.role === 'workflow') {
      subAgentWorkflow = message
      break
    }
  }
  if (!subAgentWorkflow) return null

  const hasContent = subAgentWorkflow.messages.some((i) => i.role !== 'user')
  const isComplete = result?.status === 'success'

  return (
    <div className='border-border/50 bg-background/50 my-4 rounded-lg border shadow-sm transition-all hover:shadow-md'>
      {/* Header */}
      <div
        className='border-border/30 sticky top-0 z-10 flex cursor-pointer items-center justify-between rounded-t-lg border-b bg-[#ebf1f8] px-4 py-3 transition-colors dark:bg-[#030910]'
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className='flex min-w-0 items-center gap-3'>
          <div className='bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full'>
            <Bot className='h-4 w-4' />
          </div>
          <div className='flex min-w-0 flex-col'>
            <div className='flex items-center gap-2'>
              <span className='truncate text-sm font-semibold'>Sub-Agent</span>
              <span className='bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium'>
                {JSON.parse(toolCall.function?.arguments).agentName || 'Tool'}
              </span>
              {isComplete && (
                <span className='bg-success/10 text-success rounded-full px-2 py-0.5 text-xs font-medium'>
                  Complete
                </span>
              )}
            </div>
            {duration && (
              <div className='text-text-secondary flex items-center gap-1 text-xs'>
                <Clock className='h-3 w-3' />
                <span>{duration}</span>
              </div>
            )}
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-2'>
          {!isComplete && <Loader2 className='text-primary h-4 w-4 animate-spin' />}
          <button className='hover:bg-background/50 rounded-md p-1 transition-colors'>
            {isExpanded ? (
              <ChevronUp className='text-text-secondary h-4 w-4' />
            ) : (
              <ChevronDown className='text-text-secondary h-4 w-4' />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && hasContent && (
        <div className='bg-background/30 space-y-3 px-4 py-3'>
          <div className='relative'>
            <div className='space-y-3'>
              {subAgentWorkflow.messages
                .filter((i) => i.role !== 'user')
                .map((message) => {
                  return (
                    <div key={message.id} className='relative'>
                      <MessageView workflow={subAgentWorkflow} message={message} />
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(durationMs?: number) {
  if (!durationMs) return null
  if (durationMs < 1000) return `${durationMs}ms`

  const seconds = durationMs / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`

  return `${Math.round(seconds)}s`
}
