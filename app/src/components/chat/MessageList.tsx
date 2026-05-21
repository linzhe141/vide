import { ChevronLeft, ChevronRight, GitBranch, RefreshCcw, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router'
import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
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

function RegeneratedBranchSwitcher({ workflow }: { workflow: Workflow }) {
  const { sessionId } = useChatContext()
  const session = useSession(sessionId)
  const { switchBranch } = useSessionStoreActions()
  const parentNodeId = session?.workflowNodesMap[workflow.id].parent ?? null
  const branchOptions = useWorkflowBranches(sessionId, parentNodeId)
  if (!session || branchOptions.length <= 1) return null

  const siblingVariants = getSiblingVariants(branchOptions, parentNodeId)
  const currentVariantIndex = siblingVariants.findIndex((option) => {
    return getDirectChildId(option.path, parentNodeId) === workflow.id
  })

  function switchVariant(direction: number) {
    if (currentVariantIndex === -1) return
    const nextIndex =
      (currentVariantIndex + direction + siblingVariants.length) % siblingVariants.length
    const nextBranch = siblingVariants[nextIndex]
    switchBranch(session!.sessionId, nextBranch.name)
  }

  return (
    <div className='space-y-3'>
      <div className='border-foreground/10 from-foreground/[0.03] to-primary/8 rounded-2xl border bg-gradient-to-r via-transparent px-3 py-2.5'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='bg-primary/12 text-primary flex h-8 w-8 items-center justify-center rounded-full'>
              <Sparkles size={14} />
            </div>
            <div className='min-w-0'>
              <div className='text-foreground text-sm font-medium'>Response variants</div>
              <div className='text-text-info text-xs'>
                {currentVariantIndex + 1} of {siblingVariants.length}
              </div>
            </div>
          </div>

          <div className='flex items-center gap-1.5'>
            <button
              type='button'
              onClick={() => switchVariant(-1)}
              className='hover:bg-foreground/8 border-foreground/10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition'
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type='button'
              onClick={() => switchVariant(1)}
              className='hover:bg-foreground/8 border-foreground/10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition'
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SessionActions({ workflow }: { workflow: Workflow }) {
  const { handleFork, handleRegenerate, running } = useChatContext()
  const navigate = useNavigate()

  async function onClickFork() {
    const nextSessionId = await handleFork(workflow.id)
    navigate(`/chat/${nextSessionId}`)
  }

  function onClickRegenerate() {
    const regenerateBranchName = createBranchPayload({
      type: 'regenerate',
      branchName: `regenerate-${Date.now()}`,
      workflowId: workflow.id,
    })
    handleRegenerate(workflow.id, regenerateBranchName, workflow.input)
  }

  return (
    <div className='space-y-3'>
      {workflow.runtime.status === 'finished' && !running ? (
        <div className='space-y-3'>
          <RegeneratedBranchSwitcher workflow={workflow} />
          <div className='flex flex-wrap items-center gap-2'>
            <button
              type='button'
              onClick={onClickFork}
              className='border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06] inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition'
            >
              <GitBranch size={13} />
              Fork here
            </button>

            <button
              type='button'
              onClick={onClickRegenerate}
              className='border-primary/20 bg-primary/10 text-foreground hover:bg-primary/14 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition'
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

function createBranchPayload(payload: {
  branchName: string
  workflowId: string
  type: 'regenerate'
}) {
  return JSON.stringify(payload)
}

function getSiblingVariants<
  T extends {
    name: string
    path: string[]
  },
>(branchOptions: T[], parentNodeId: string | null) {
  const variantsByChildId = new Map<string, T>()

  for (const option of branchOptions) {
    if (!isRegenerateVariant(option.name)) continue

    const childId = getDirectChildId(option.path, parentNodeId)
    if (!childId) continue

    const existingOption = variantsByChildId.get(childId)
    if (!existingOption) {
      variantsByChildId.set(childId, option)
      continue
    }

    if (option.path.length < existingOption.path.length) {
      variantsByChildId.set(childId, option)
    }
  }

  return [...variantsByChildId.values()]
}

function isRegenerateVariant(branchName: string) {
  if (branchName === 'main') return true

  try {
    const payload = JSON.parse(branchName)
    return payload.type === 'regenerate'
  } catch (_e) {
    return false
  }
}

function getDirectChildId(path: string[], parentNodeId: string | null) {
  if (!path.length) return null
  if (!parentNodeId) return path[0] ?? null

  const parentIndex = path.indexOf(parentNodeId)
  if (parentIndex === -1) return null

  return path[parentIndex + 1] ?? null
}
