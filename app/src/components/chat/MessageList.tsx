import { GitBranch, RefreshCcw } from 'lucide-react'
import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
import { useSession, useSessionBlocks, useSessionStoreActions } from '../../store/sessionStore'
import { type ConversationBlock, type SessionMessage } from '../../store/sessionStore/types'
import { AskUserQuestionUserSlectedReultPrefix, AskUserQuestionView } from './AskUserQuestionView'
import { useChatContext } from './ChatProvider'
import { AssistantReasonMessage } from './messages/AssistantReasonMessage'
import { AssistantTextMessage } from './messages/AssistantTextMessage'
import { ToolCallMessage } from './messages/ToolCallMessage'
import { UserInputMessage } from './messages/UserInputMessage'

export function MessageList() {
  const { sessionId } = useChatContext()
  const blocks = useSessionBlocks(sessionId)

  return (
    <div className='flex w-full flex-col gap-12 px-8 py-12'>
      {blocks?.map((block) => <BlockView key={block.id} block={block} />)}
    </div>
  )
}

function MessageView({ block, message }: { block: ConversationBlock; message: SessionMessage }) {
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

function BranchFeedback({ block }: { block: ConversationBlock }) {
  const { sessionId } = useChatContext()
  const session = useSession(sessionId)
  const { switchBranch } = useSessionStoreActions()

  if (!session) return null

  const branchOptions = getBranchSelectorOptions(session, block.id)
  if (!branchOptions.length) return null

  return (
    <div className='text-text-info flex flex-wrap items-center gap-2 text-xs'>
      <span className='opacity-70'>Branches on this block</span>
      {branchOptions.map((option) => (
        <button
          key={option.name}
          type='button'
          onClick={() => switchBranch(sessionId, option.name)}
          className={`rounded-full border px-2.5 py-1 transition ${
            option.isActive
              ? 'border-foreground/20 bg-foreground/6 text-foreground'
              : 'hover:bg-border/60'
          }`}
        >
          {option.name}
          {option.isActive ? ' current' : ''}
        </button>
      ))}
    </div>
  )
}

function SessionActions({ block }: { block: ConversationBlock }) {
  const { handleFork, handleRegenerate, running } = useChatContext()

  return (
    <div className='space-y-3'>
      <BranchFeedback block={block} />
      {block.runtime.status === 'finished' && !running && (
        <div className='text-text-info flex items-center gap-2 text-xs'>
          <button
            type='button'
            onClick={() => handleFork(block.id)}
            className='hover:bg-border/60 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition'
          >
            <GitBranch size={12} />
            Fork From Here
          </button>
          <button
            type='button'
            onClick={() => handleRegenerate(block)}
            className='hover:bg-border/60 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition'
          >
            <RefreshCcw size={12} />
            Re-generate From Parent
          </button>
        </div>
      )}
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
