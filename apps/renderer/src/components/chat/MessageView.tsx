import { memo } from 'react'
import type { SessionMessage, ToolCallState, Workflow } from '@/store/sessionStore/types'
import { UserInputMessage } from './messages/UserInputMessage'
import { AssistantTextMessage } from './messages/AssistantTextMessage'
import { AssistantReasonMessage } from './messages/AssistantReasonMessage'
import { ToolCallMessage } from './messages/ToolCallMessage'
import { AskUserQuestionMessage } from './messages/AskUserQuestionMessage'
import { ReasoningBlockMessage } from './messages/ReasoningBlockMessage'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

type MessageViewProps = {
  message: SessionMessage
  workflowId: string
  workflowStatus: Workflow['runtime']['status']
  latestWebSearchToolCall?: ToolCallState | null
}

export const MessageView = memo(function MessageView({
  message,
  workflowId,
  workflowStatus,
  latestWebSearchToolCall,
}: MessageViewProps) {
  switch (message.role) {
    case 'user':
      return <UserInputMessage message={message} workflowId={workflowId} />

    case 'assistant-text':
      return (
        <AssistantTextMessage message={message} latestWebSearchToolCall={latestWebSearchToolCall} />
      )

    case 'assistant-reason':
      return <AssistantReasonMessage message={message} />

    case 'reasoning-block':
      return (
        <ReasoningBlockMessage
          workflowId={workflowId}
          workflowStatus={workflowStatus}
          message={message}
        />
      )

    case 'tool-call':
      return (
        <ToolCallMessage
          workflowId={workflowId}
          workflowStatus={workflowStatus}
          message={message}
        />
      )

    case 'ask-user-question':
      return <AskUserQuestionMessage workflowId={workflowId} message={message} />

    case 'error':
      return (
        <div className='rounded-3xl border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-600 dark:text-red-400'>
          <MarkdownRenderer animation={false}>
            {JSON.stringify(message.error, null, 2)}
          </MarkdownRenderer>
        </div>
      )
  }
})
