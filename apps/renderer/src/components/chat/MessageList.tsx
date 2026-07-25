import { useSessionWorkflows } from '../../store/sessionStore'
import { type Workflow } from '../../store/sessionStore/types'

import { useChatContext } from './ChatProvider'
import { MessageView } from './MessageView'
import { SessionActions, RegeneratedBranchSwitcher } from './SessionActions'
import { CircleStop } from 'lucide-react'

export function MessageList() {
  const { sessionId } = useChatContext()
  const workflows = useSessionWorkflows(sessionId)

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10'>
      {workflows?.map((workflow) => (
        <>
          <WorkflowView key={workflow.id} workflow={workflow} />
          {workflow.runtime.status === 'aborted' && <AbortedStatus />}
          {workflow.runtime.status === 'running' && <LoadingStatusCircle />}
          {workflow.runtime.status === 'finished' && <SessionActions workflow={workflow} />}
          <RegeneratedBranchSwitcher workflow={workflow} />
        </>
      ))}
    </div>
  )
}

function WorkflowView({ workflow }: { workflow: Workflow }) {
  return (
    <div className='space-y-6' id={workflow.id}>
      {workflow.messages
        .filter((i) => i.role !== 'workflow')
        .map((message) => {
          return <MessageView key={message.id} workflow={workflow} message={message} />
        })}
    </div>
  )
}

function LoadingStatusCircle() {
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
}

function AbortedStatus() {
  return (
    <div className='border-border/60 bg-background text-text-secondary flex items-center gap-2 rounded-xl border px-3 py-2 text-sm'>
      <CircleStop className='text-text-secondary/80 h-4 w-4' />

      <span>Workflow aborted</span>
    </div>
  )
}
