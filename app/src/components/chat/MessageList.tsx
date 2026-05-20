import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  RefreshCcw,
  Sparkles,
  Split,
} from 'lucide-react'
import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
import { createBranchPayload } from '../../lib/branching'
import {
  useSession,
  useSessionStoreActions,
  useSessionWorkflows,
  useWorkflowBranches,
} from '../../store/sessionStore'
import { type SessionMessage, type Workflow } from '../../store/sessionStore/types'
import { AskUserQuestionUserSlectedReultPrefix, AskUserQuestionView } from './AskUserQuestionView'
import { useChatContext } from './ChatProvider'
import { AssistantReasonMessage } from './messages/AssistantReasonMessage'
import { AssistantTextMessage } from './messages/AssistantTextMessage'
import { ToolCallMessage } from './messages/ToolCallMessage'
import { UserInputMessage } from './messages/UserInputMessage'

export function MessageList() {
  const { sessionId } = useChatContext()
  const workflows = useSessionWorkflows(sessionId)

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10'>
      {workflows?.map((workflow) => <WorkflowView key={workflow.id} workflow={workflow} />)}
    </div>
  )
}

function MessageView({ workflow, message }: { workflow: Workflow; message: SessionMessage }) {
  switch (message.role) {
    case 'user':
      return message.content.startsWith(AskUserQuestionUserSlectedReultPrefix) ? null : (
        <UserInputMessage message={message} />
      )

    case 'assistant-text':
      return <AssistantTextMessage message={message} />

    case 'assistant-reason':
      return <AssistantReasonMessage message={message} workflow={workflow} />

    case 'tool-call':
      return <ToolCallMessage workflow={workflow} message={message} />

    case 'tool-result':
      return null

    case 'ask-user':
      return <AskUserQuestionView workflowId={workflow.id} message={message} />

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

function BranchFeedback({ workflow }: { workflow: Workflow }) {
  const { sessionId } = useChatContext()
  const session = useSession(sessionId)
  const { switchBranch } = useSessionStoreActions()
  const branchOptions = useWorkflowBranches(sessionId, workflow.id)

  if (!session || branchOptions.length === 0) return null

  const currentBranchIndex = branchOptions.findIndex((option) => option.branchName === session.activeBranch)
  const currentBranch =
    currentBranchIndex >= 0 ? branchOptions[currentBranchIndex] : branchOptions[0] ?? null
  const regenerateOptions = branchOptions.filter((option) => option.type === 'regenerate')
  const forkOptions = branchOptions.filter((option) => option.type === 'fork')
  const regenerateVariants = branchOptions.filter(
    (option) =>
      option.branchName === session.activeBranch ||
      option.type === 'regenerate' ||
      option.type === 'main'
  )
  const currentVariantIndex = Math.max(
    regenerateVariants.findIndex((option) => option.branchName === session.activeBranch),
    0
  )
  const showRegenerateSwitcher =
    !!currentBranch &&
    regenerateVariants.length > 1 &&
    (currentBranch.type === 'regenerate' || regenerateOptions.length > 0)

  function switchVariant(offset: -1 | 1) {
    if (regenerateVariants.length < 2) return
    const nextIndex =
      (currentVariantIndex + offset + regenerateVariants.length) % regenerateVariants.length
    switchBranch(sessionId, regenerateVariants[nextIndex].branchName)
  }

  function getVariantLabel() {
    if (!currentBranch) return ''
    if (currentBranch.type === 'regenerate') {
      const regenerateIndex =
        regenerateOptions.findIndex((option) => option.branchName === currentBranch.branchName) + 1
      return `Alternative ${regenerateIndex}`
    }
    return 'Original'
  }

  return (
    <div className='space-y-3'>
      {showRegenerateSwitcher ? (
        <div className='rounded-2xl border border-foreground/10 bg-gradient-to-r from-foreground/[0.03] via-transparent to-primary/8 px-3 py-2.5'>
          <div className='flex items-center justify-between gap-3'>
            <div className='flex min-w-0 items-center gap-3'>
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-primary'>
                <Sparkles size={14} />
              </div>
              <div className='min-w-0'>
                <div className='text-foreground text-sm font-medium'>Response variants</div>
                <div className='text-text-info text-xs'>
                  {getVariantLabel()} / {currentVariantIndex + 1} of {regenerateVariants.length}
                </div>
              </div>
            </div>

            <div className='flex items-center gap-1.5'>
              <button
                type='button'
                onClick={() => switchVariant(-1)}
                className='hover:bg-foreground/8 inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 transition'
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type='button'
                onClick={() => switchVariant(1)}
                className='hover:bg-foreground/8 inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 transition'
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {forkOptions.length > 0 ? (
        <div className='flex flex-wrap items-center gap-2'>
          <div className='text-text-info inline-flex items-center gap-1 text-xs'>
            <Split size={12} />
            Split branches
          </div>
          {forkOptions.map((option, index) => (
            <button
              key={option.branchName}
              type='button'
              onClick={() => switchBranch(sessionId, option.branchName)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${
                session.activeBranch === option.branchName
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'hover:bg-foreground/5 border-foreground/10 text-text-info'
              }`}
            >
              <GitBranch size={12} />
              {`Fork ${index + 1}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SessionActions({ workflow }: { workflow: Workflow }) {
  const { handleFork, handleRegenerate, running, sessionId } = useChatContext()
  const branchOptions = useWorkflowBranches(sessionId, workflow.id)
  const forkCount = branchOptions.filter((option) => option.type === 'fork').length
  const regenerateCount = branchOptions.filter((option) => option.type === 'regenerate').length

  const forkBranchName = createBranchPayload({
    type: 'fork',
    branchName: `fork-${forkCount + 1}`,
    workflowId: workflow.id,
  })

  function onClickRegenerate() {
    const regenerateBranchName = createBranchPayload({
      type: 'regenerate',
      branchName: `regenerate-${regenerateCount + 1}`,
      workflowId: workflow.id,
    })
    handleRegenerate(workflow.id, regenerateBranchName, workflow.input)
  }

  return (
    <div className='space-y-3'>
      {workflow.runtime.status === 'finished' && !running ? (
        <div className='space-y-3'>
          <BranchFeedback workflow={workflow} />
          <div className='flex flex-wrap items-center gap-2'>
            <button
              type='button'
              onClick={() => handleFork(workflow.id, forkBranchName)}
              className='inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3.5 py-2 text-xs font-medium transition hover:bg-foreground/[0.06]'
            >
              <GitBranch size={13} />
              Fork here
            </button>

            <button
              type='button'
              onClick={onClickRegenerate}
              className='inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-primary/14'
            >
              <RefreshCcw size={13} />
              Regenerate
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function WorkflowView({ workflow }: { workflow: Workflow }) {
  return (
    <div className='space-y-6' id={workflow.id}>
      {workflow.messages.map((message) => (
        <MessageView key={message.id} workflow={workflow} message={message} />
      ))}
      <SessionActions workflow={workflow} />
    </div>
  )
}
