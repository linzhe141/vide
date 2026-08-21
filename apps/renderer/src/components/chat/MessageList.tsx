import { useSessionWorkflows } from '../../store/sessionStore'
import React, { memo, useMemo } from 'react'
import { type ToolCallState, type Workflow } from '../../store/sessionStore/types'

import { useChatContext } from '@/hooks/useChatContext'
import { MessageView } from './MessageView'
import { SessionActions, RegeneratedBranchSwitcher } from './SessionActions'
import { CircleStop } from 'lucide-react'

export const MessageList = memo(function MessageList() {
  const { sessionId } = useChatContext()
  const workflows = useSessionWorkflows(sessionId)

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10'>
      {workflows?.map((workflow) => (
        <React.Fragment key={workflow.id}>
          <WorkflowView workflow={workflow} />
          {workflow.runtime.status === 'aborted' && <AbortedStatus />}
          {workflow.runtime.status === 'running' && <LoadingStatusCircle />}
          {workflow.runtime.status === 'finished' && (
            <SessionActions
              workflowId={workflow.id}
              workflowInput={workflow.input}
              feedback={workflow.feedback}
            />
          )}
          <RegeneratedBranchSwitcher workflowId={workflow.id} />
        </React.Fragment>
      ))}
    </div>
  )
})

const WorkflowView = memo(function WorkflowView({ workflow }: { workflow: Workflow }) {
  const visibleMessages = useMemo(
    () => workflow.messages.filter((message) => message.role !== 'workflow'),
    [workflow.messages]
  )

  const latestWebSearchToolCall = useMemo<ToolCallState | null>(() => {
    for (let index = workflow.messages.length - 1; index >= 0; index -= 1) {
      const message = workflow.messages[index]
      if (message.role !== 'tool-call') continue

      const toolCall = message.toolCalls.find((item) => item.toolCall.function.name === 'websearch')
      if (toolCall) return toolCall
    }

    return null
  }, [workflow.messages])

  return (
    <div className='space-y-6' id={workflow.id}>
      {visibleMessages.map((message) => {
        return (
          <MessageView
            key={message.id}
            workflow={workflow}
            message={message}
            latestWebSearchToolCall={latestWebSearchToolCall}
          />
        )
      })}
    </div>
  )
})

const LoadingStatusCircle = memo(function LoadingStatusCircle() {
  return (
    <div className='flex items-center gap-1.5 px-1'>
      <div
        className='bg-primary h-2 w-2 animate-[typing_1.1s_infinite] rounded-full opacity-90'
        style={{
          animationDelay: '-0.32s',
        }}
      />

      <div
        className='bg-primary h-2 w-2 animate-[typing_1.1s_infinite] rounded-full opacity-75'
        style={{
          animationDelay: '-0.16s',
        }}
      />

      <div className='bg-primary h-2 w-2 animate-[typing_1.1s_infinite] rounded-full opacity-60' />
    </div>
  )
})

const AbortedStatus = memo(function AbortedStatus() {
  return (
    <div className='border-border/60 bg-background text-text-secondary flex items-center gap-2 rounded-xl border px-3 py-2 text-sm'>
      <CircleStop className='text-text-secondary/80 h-4 w-4' />

      <span>Workflow aborted</span>
    </div>
  )
})
