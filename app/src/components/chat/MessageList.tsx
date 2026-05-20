import { GitBranch, RefreshCcw } from 'lucide-react'
import { MarkdownRenderer } from '../../components/markdown/MarkdownRenderer'
import {
  useWorkflowBranches,
  useSession,
  useSessionWorkflows,
  useSessionStore,
  useSessionStoreActions,
} from '../../store/sessionStore'
import { type Workflow, type SessionMessage } from '../../store/sessionStore/types'
import { AskUserQuestionUserSlectedReultPrefix, AskUserQuestionView } from './AskUserQuestionView'
import { useChatContext } from './ChatProvider'
import { AssistantReasonMessage } from './messages/AssistantReasonMessage'
import { AssistantTextMessage } from './messages/AssistantTextMessage'
import { ToolCallMessage } from './messages/ToolCallMessage'
import { UserInputMessage } from './messages/UserInputMessage'

export function MessageList() {
  const { sessionId } = useChatContext()
  const workflows = useSessionWorkflows(sessionId)
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
      <span className='opacity-70'>Branches on this workflow</span>
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

function SessionActions({ workflow }: { workflow: Workflow }) {
  const { handleFork, running, sessionId } = useChatContext()
  const branchOptions = useWorkflowBranches(sessionId, workflow.id)

  const firstBranch = branchOptions[0]
  let forkBranchName = ''
  if (firstBranch.branchName === 'main') {
    forkBranchName = JSON.stringify({
      branchName: `v-${branchOptions.length}`,
      workflowId: workflow.id,
    })
  } else {
    forkBranchName = JSON.stringify({
      branchName: `[${JSON.parse(firstBranch.branchName).branchName}]-${branchOptions.length}`,
      workflowId: workflow.id,
    })
  }
  return (
    <div className='space-y-3'>
      {workflow.runtime.status === 'finished' && !running && (
        <div>
          <BranchFeedback workflow={workflow} />
          <div className='text-text-info my-2 flex items-center gap-2 text-xs'>
            <button
              type='button'
              onClick={() => handleFork(workflow.id, forkBranchName)}
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
