import { memo, useDeferredValue, useMemo } from 'react'
import { useSessionWorkflow, useSessionWorkflowIds } from '../../store/sessionStore'
import { type ToolCallState, type Workflow } from '../../store/sessionStore/types'
import { findLatestToolCallByName } from '../../store/sessionStore/workflowMessageModel'

import { useChatContext } from '@/hooks/useChatContext'
import { MessageView } from './MessageView'
import { SessionActions, RegeneratedBranchSwitcher } from './SessionActions'
import { CircleStop } from 'lucide-react'

export const MessageList = memo(function MessageList() {
  const { sessionId } = useChatContext()
  const workflowIds = useSessionWorkflowIds(sessionId)

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10'>
      {workflowIds.map((workflowId) => (
        <WorkflowSection key={workflowId} sessionId={sessionId} workflowId={workflowId} />
      ))}
    </div>
  )
})

const WorkflowSection = memo(function WorkflowSection({
  sessionId,
  workflowId,
}: {
  sessionId: string
  workflowId: string
}) {
  const workflow = useSessionWorkflow(sessionId, workflowId)
  const deferredWorkflow = useDeferredValue(workflow)
  if (!workflow) return null

  const displayWorkflow = deferredWorkflow ?? workflow

  return (
    <>
      <WorkflowView workflow={displayWorkflow} />
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
    </>
  )
})

const WorkflowView = memo(function WorkflowView({ workflow }: { workflow: Workflow }) {
  const visibleMessages = useMemo(
    () => workflow.messages.filter((message) => message.role !== 'workflow'),
    [workflow.messages]
  )
  const pendingSteeringMessages = workflow.runtime.pendingSteeringMessages ?? []

  const latestWebSearchToolCall = useMemo<ToolCallState | null>(() => {
    return findLatestToolCallByName(workflow, 'websearch')
  }, [workflow.messages])

  return (
    <div className='space-y-6' id={workflow.id}>
      {visibleMessages.map((message) => {
        return (
          <MessageView
            key={message.id}
            message={message}
            workflowId={workflow.id}
            workflowStatus={workflow.runtime.status}
            latestWebSearchToolCall={latestWebSearchToolCall}
          />
        )
      })}
      {pendingSteeringMessages.map((message) => {
        return (
          <MessageView
            key={message.id}
            message={message}
            workflowId={workflow.id}
            workflowStatus={workflow.runtime.status}
            latestWebSearchToolCall={latestWebSearchToolCall}
          />
        )
      })}
    </div>
  )
})

const LoadingStatusCircle = memo(function LoadingStatusCircle() {
  return (
    <div className='flex items-center gap-1.5 px-1' role='status'>
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
      <span className='sr-only' aria-live='polite'>
        Responding…
      </span>
    </div>
  )
})

const AbortedStatus = memo(function AbortedStatus() {
  return (
    <div className='border-border/60 bg-background text-text-secondary flex items-center gap-2 rounded-xl border px-3 py-2 text-sm'>
      <CircleStop className='text-text-secondary/80 h-4 w-4' aria-hidden='true' />
      <span>Workflow aborted</span>
    </div>
  )
})
