import { GitBranch, RefreshCcw } from 'lucide-react'
import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
import {
  useThread,
  useThreadStoreActions,
  useThreadBlocks,
  type ConversationBlock,
  type ThreadMessage,
} from '../../store/threadStore'
import { AskUserQuestionUserSlectedReultPrefix, AskUserQuestionView } from './AskUserQuestionView'
import { useChatContext } from './ChatProvider'
import { AssistantReasonMessage } from './messages/AssistantReasonMessage'
import { AssistantTextMessage } from './messages/AssistantTextMessage'
import { ToolCallMessage } from './messages/ToolCallMessage'
import { UserInputMessage } from './messages/UserInputMessage'

export function MessageList() {
  const { threadId } = useChatContext()
  const thread = useThread(threadId)
  const blocks = useThreadBlocks(threadId)
  const { switchBranch } = useThreadStoreActions()

  return (
    <div className='flex w-full flex-col gap-12 px-8 py-12'>
      {thread && (
        <div className='flex flex-wrap items-center gap-2 text-xs'>
          {thread.branches.map((branch) => (
            <button
              key={branch.name}
              type='button'
              onClick={() => switchBranch(threadId, branch.name)}
              className={`rounded-full border px-2 py-1 transition ${
                branch.name === thread.activeBranch ? 'bg-border/70 text-foreground' : 'text-text-info'
              }`}
            >
              {branch.name}
            </button>
          ))}
        </div>
      )}
      {blocks?.map((block) => <BlockView key={block.id} block={block} />)}
    </div>
  )
}

function MessageView({ block, message }: { block: ConversationBlock; message: ThreadMessage }) {
  switch (message.role) {
    case 'user':
      return message.content.startsWith(AskUserQuestionUserSlectedReultPrefix) ? null : (
        <UserInputMessage message={message} />
      )

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

function SessionActions({ block }: { block: ConversationBlock }) {
  const { handleFork, handleRegenerate, running } = useChatContext()

  return (
    <div className='text-text-info flex items-center gap-2 text-xs'>
      <button
        type='button'
        disabled={running}
        onClick={() => handleFork(block.id)}
        className='hover:bg-border/60 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-50'
      >
        <GitBranch size={12} />
        Fork
      </button>
      <button
        type='button'
        disabled={running}
        onClick={() => handleRegenerate(block)}
        className='hover:bg-border/60 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-50'
      >
        <RefreshCcw size={12} />
        Re-generate
      </button>
    </div>
  )
}

function BlockView({ block }: { block: ConversationBlock }) {
  return (
    <div className='space-y-6' id={block.id}>
      {block.messages.map((message) => (
        <MessageView key={message.id} block={block} message={message} />
      ))}
      <SessionActions block={block} />
    </div>
  )
}
