import type { UserInputSessionMessage, Workflow } from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'
import { Check, Copy, Pen, X } from 'lucide-react'
import { useEffect, useState, type PropsWithChildren } from 'react'
import { createBranchPayload } from '../SessionActions'
import { useChatContext } from '@/hooks/useChatContext'
import { useSessionStoreActions } from '../../../store/sessionStore'

export function UserInputMessage({
  message,
  workflow,
}: {
  message: UserInputSessionMessage
  workflow: Workflow
}) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(message.content)
  const { sessionId, handleRegenerate } = useChatContext()
  const { changeWorkflowInput } = useSessionStoreActions()

  return (
    <div className='group flex justify-end px-3 py-2'>
      <div className='max-w-[min(78%,720px)] space-y-2'>
        <div
          className={`border-border/60 bg-foreground/[0.03] group-hover:border-border relative overflow-hidden rounded-[26px] rounded-br-md border px-5 py-3.5 text-[15px] leading-7 shadow-sm backdrop-blur-xl transition-all duration-200 group-hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.045]`}
        >
          {editing ? (
            <textarea
              className='w-[460px] resize-none'
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
            ></textarea>
          ) : (
            <MarkdownRenderer animation={false} className='relative z-10 text-inherit'>
              {message.content}
            </MarkdownRenderer>
          )}
        </div>

        <div className='flex justify-end pr-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
          <UserInputMessageActions
            message={message}
            editing={editing}
            actions={{
              onEdit: () => setEditing(true),
              onSave: () => {
                setEditing(false)
                changeWorkflowInput({
                  sessionId: sessionId,
                  workflowId: workflow.id,
                  newInput: content,
                })
                const regenerateBranchName = createBranchPayload({
                  type: 'regenerate',
                  branchName: `regenerate-${Date.now()}`,
                  workflowId: workflow.id,
                })
                handleRegenerate(workflow.id, regenerateBranchName, content)
              },
              onCancel: () => {
                setEditing(false)
                setContent(message.content)
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}

function UserInputMessageActions({
  message,
  actions,
  editing,
}: {
  message: UserInputSessionMessage
  editing: boolean
  actions: {
    onEdit: () => void
    onSave: () => void
    onCancel: () => void
  }
}) {
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopySuccess(true)
  }

  useEffect(() => {
    if (!copySuccess) return

    const timer = setTimeout(() => {
      setCopySuccess(false)
    }, 1800)

    return () => clearTimeout(timer)
  }, [copySuccess])

  return (
    <div className='flex items-center gap-2'>
      {editing ? (
        <>
          <ActionButton onClick={() => actions.onSave()}>
            <Check size={13} className='text-green-500' strokeWidth={2.5} />
            <span className='text-[11px] font-medium'>Save</span>
          </ActionButton>

          <ActionButton onClick={actions.onCancel}>
            <X size={13} className='text-red-500' strokeWidth={2.5} />
            <span className='text-[11px] font-medium'>Cancel</span>
          </ActionButton>
        </>
      ) : (
        <>
          <ActionButton onClick={handleCopy}>
            <div className='flex items-center justify-center'>
              {copySuccess ? (
                <Check size={13} className='text-green-500' strokeWidth={2.5} />
              ) : (
                <Copy size={13} strokeWidth={2.3} />
              )}
            </div>

            <span className='text-[11px] font-medium'>{copySuccess ? 'Copied' : 'Copy'}</span>
          </ActionButton>

          <ActionButton onClick={actions.onEdit}>
            <Pen size={13} strokeWidth={2.3} />
            <span className='text-[11px] font-medium'>Edit</span>
          </ActionButton>
        </>
      )}
    </div>
  )
}

function ActionButton({ onClick, children }: PropsWithChildren<{ onClick?: () => void }>) {
  return (
    <button
      type='button'
      onClick={() => onClick?.()}
      className={`text-text-secondary hover:border-border hover:bg-foreground/[0.04] hover:text-foreground flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1.5 transition-all duration-200 active:scale-95`}
    >
      {children}
    </button>
  )
}
