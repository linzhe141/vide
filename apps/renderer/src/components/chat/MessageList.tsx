import { MarkdownRenderer } from '../markdown/MarkdownRenderer'
import { useSessionWorkflows } from '../../store/sessionStore'
import { type SessionMessage, type Workflow } from '../../store/sessionStore/types'
import {
  AskUserQuestionUserSlectedReultPrefix,
  AskUserQuestionMessage,
} from './messages/AskUserQuestionMessage'
import { useChatContext } from './ChatProvider'
import { AssistantReasonMessage } from './messages/AssistantReasonMessage'
import { AssistantTextMessage } from './messages/AssistantTextMessage'
import { ToolCallMessage } from './messages/ToolCallMessage'
import { UserInputMessage } from './messages/UserInputMessage'
import { SessionActions, RegeneratedBranchSwitcher } from './SessionActions'
import { CircleStop } from 'lucide-react'

export function MessageList() {
  const { sessionId } = useChatContext()
  const workflows = useSessionWorkflows(sessionId)

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10'>
      {workflows?.map((workflow) => (
        <WorkflowView key={workflow.id} workflow={workflow} />
      ))}
    </div>
  )
}

function MessageView({ workflow, message }: { workflow: Workflow; message: SessionMessage }) {
  switch (message.role) {
    case 'user':
      return message.content.startsWith(AskUserQuestionUserSlectedReultPrefix) ? null : (
        <UserInputMessage message={message} workflow={workflow} />
      )

    case 'assistant-text':
      return <AssistantTextMessage message={message} />

    case 'assistant-reason':
      return <AssistantReasonMessage message={message} />

    case 'tool-call':
      return <ToolCallMessage workflow={workflow} message={message} />

    case 'tool-result':
      return null

    case 'ask-user':
      return <AskUserQuestionMessage workflowId={workflow.id} message={message} />

    case 'error':
      return (
        <div className='rounded-[24px] border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-600 dark:text-red-400'>
          <MarkdownRenderer animation={false}>
            {JSON.stringify(message.error, null, 2)}
          </MarkdownRenderer>
        </div>
      )
  }
}

function WorkflowView({ workflow }: { workflow: Workflow }) {
  return (
    <div className='space-y-6' id={workflow.id}>
      {workflow.messages.map((message) => (
        <MessageView key={message.id} workflow={workflow} message={message} />
      ))}
      {workflow.runtime.status === 'aborted' && <AbortedStatus />}
      {workflow.runtime.status === 'running' && <LoadingStatusCircle />}
      {workflow.runtime.status === 'finished' && <SessionActions workflow={workflow} />}
      <RegeneratedBranchSwitcher workflow={workflow} />
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
