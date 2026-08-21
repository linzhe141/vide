import type { SessionMessage, ToolCallState, Workflow } from '@/store/sessionStore/types'
import { UserInputMessage } from './messages/UserInputMessage'
import { AssistantTextMessage } from './messages/AssistantTextMessage'
import { AssistantReasonMessage } from './messages/AssistantReasonMessage'
import { ToolCallMessage } from './messages/ToolCallMessage'
import { AskUserQuestionMessage } from './messages/AskUserQuestionMessage'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

type MessageViewProps = {
  workflow: Workflow
  message: SessionMessage
  latestWebSearchToolCall?: ToolCallState | null
}

export function MessageView({ workflow, message, latestWebSearchToolCall }: MessageViewProps) {
  switch (message.role) {
    case 'user':
      return (
        <UserInputMessage
          message={message}
          workflowId={workflow.id}
          workflowInputSource={workflow.inputSource}
        />
      )

    case 'assistant-text':
      return (
        <AssistantTextMessage message={message} latestWebSearchToolCall={latestWebSearchToolCall} />
      )

    case 'assistant-reason':
      return <AssistantReasonMessage message={message} />

    case 'tool-call':
      return <ToolCallMessage workflow={workflow} message={message} />

    case 'ask-user-question':
      return <AskUserQuestionMessage workflowId={workflow.id} message={message} />

    case 'error':
      return (
        <div className='rounded-3xl border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-600 dark:text-red-400'>
          <MarkdownRenderer animation={false}>
            {JSON.stringify(message.error, null, 2)}
          </MarkdownRenderer>
        </div>
      )
  }
}
