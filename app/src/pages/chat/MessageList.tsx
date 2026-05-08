import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
import {
  useThreadBlocks,
  type ConversationBlock,
  type ThreadMessage,
} from '../../store/threadStore'
import { useChatContext } from './ChatProvider'
import { AskUserQuestionView } from './AskUserQuestionView'
import { UserInputMessage } from '../../components/messages/UserInputMessage'
import { AssistantTextMessage } from '../../components/messages/AssistantTextMessage'
import { AssistantReasonMessage } from '../../components/messages/AssistantReasonMessage'
import { ToolCallMessage } from '../../components/messages/ToolCallMessage'

function MessageView({ block, message }: { block: ConversationBlock; message: ThreadMessage }) {
  switch (message.role) {
    case 'user':
      return <UserInputMessage message={message} />

    case 'assistant-text':
      return <AssistantTextMessage message={message} />

    case 'assistant-reason':
      return <AssistantReasonMessage message={message} block={block} />

    case 'tool-call':
      return <ToolCallMessage block={block} message={message} />

    case 'tool-result':
      return null

    case 'ask-user':
      return <AskUserQuestionView blockId={block.id} message={message} />

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

function BlockView({ block }: { block: ConversationBlock }) {
  return (
    <div className='space-y-6'>
      {block.messages.map((message) => (
        <MessageView key={message.id} block={block} message={message} />
      ))}
    </div>
  )
}

export function MessageList() {
  const { threadId } = useChatContext()
  const blocks = useThreadBlocks(threadId)

  return (
    <div className='mx-auto flex w-full max-w-[920px] flex-col gap-12 px-8 py-12'>
      {blocks?.map((block) => <BlockView key={block.id} block={block} />)}
    </div>
  )
}
