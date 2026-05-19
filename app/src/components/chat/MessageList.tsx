import { GitBranch, RefreshCcw } from 'lucide-react'
import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
import {
  useBlockBranches,
  useSession,
  useSessionBlocks,
  useSessionStore,
  useSessionStoreActions,
} from '../../store/sessionStore'
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
  const sessionWorkflowTree = useSessionStore((s) => s.sessionWorkflowTree)
  const { buildSessionWorkflowTree } = useSessionStoreActions()
  return (
    <div className='flex w-full flex-col gap-12 px-8 py-12'>
      <button
        onClick={() => {
          buildSessionWorkflowTree(sessionId)
          setTimeout(() => {
            console.log('sessionWorkflowTree', sessionWorkflowTree)
          }, 100)
        }}
      >
        refresh
      </button>
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
  const branchOptions = useBlockBranches(sessionId, block.id)
  if (!session) return null

  function getBranchNameLabel(branchName: string) {
    try {
      const { branchName: label } = JSON.parse(branchName)
      return label
    } catch (_e) {
      return branchName
    }
  }
  return (
    <div className='text-text-info flex flex-wrap items-center gap-2 text-xs'>
      <span className='opacity-70'>Branches on this block</span>
      {branchOptions.map((option) => (
        <button
          key={option.branchName}
          type='button'
          onClick={() => switchBranch(sessionId, option.branchName)}
          className={`rounded-full border px-2.5 py-1 transition ${
            session.activeBranch === option.branchName
              ? 'bg-foreground/6 text-foreground border-primary'
              : 'hover:bg-border/60'
          }`}
        >
          {getBranchNameLabel(option.branchName)}
        </button>
      ))}
    </div>
  )
}

function SessionActions({ block }: { block: ConversationBlock }) {
  const { handleFork, running, sessionId } = useChatContext()
  const branchOptions = useBlockBranches(sessionId, block.id)

  const firstBranch = branchOptions[0]
  let forkBranchName = ''
  if (firstBranch.branchName === 'main') {
    forkBranchName = JSON.stringify({
      branchName: `v-${branchOptions.length}`,
      blockId: block.id,
    })
  } else {
    forkBranchName = JSON.stringify({
      branchName: `[${JSON.parse(firstBranch.branchName).branchName}]-${branchOptions.length}`,
      blockId: block.id,
    })
  }
  return (
    <div className='space-y-3'>
      {block.runtime.status === 'finished' && !running && (
        <div>
          <BranchFeedback block={block} />
          <div className='text-text-info my-2 flex items-center gap-2 text-xs'>
            <button
              type='button'
              onClick={() => handleFork(block.id, forkBranchName)}
              className='hover:bg-border/60 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition'
            >
              <GitBranch size={12} />
              Fork From Here
            </button>
          </div>
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
