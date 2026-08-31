import { memo, useCallback, useEffect, useState, type PropsWithChildren } from 'react'
import type { UserInputSessionMessage, Workflow } from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'
import { Check, Copy, Monitor, MessageCircle, Pen, X } from 'lucide-react'
import { createBranchPayload } from '../SessionActions'
import { useChatContext } from '@/hooks/useChatContext'
import { useSessionStoreActions } from '../../../store/sessionStore'
import { parseAskQuestionAnswerPayload } from '../../../store/sessionStore/askQuestion'

type UserInputMessageProps = {
  message: UserInputSessionMessage
  workflowId: string
}

export const UserInputMessage = memo(function UserInputMessage({
  message,
  workflowId,
}: UserInputMessageProps) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(message.content)
  const { sessionId, handleRegenerate } = useChatContext()
  const { changeWorkflowInput } = useSessionStoreActions()
  const isWechatBotInput = message.inputSource === 'wechat-bot'
  const isQueuedSteering = message.kind === 'steering' && message.pending
  const isAppliedSteering = message.kind === 'steering' && !message.pending
  const canEdit = message.kind === 'root' && !message.pending
  const sourceLabel = isWechatBotInput ? 'WeChat Bot' : 'Desktop'
  const SourceIcon = isWechatBotInput ? MessageCircle : Monitor
  const handleEdit = useCallback(() => {
    if (!canEdit) return
    setEditing(true)
  }, [canEdit])

  const handleSave = useCallback(() => {
    if (!canEdit) return
    setEditing(false)
    changeWorkflowInput({
      sessionId,
      workflowId,
      newInput: content,
    })
    const regenerateBranchName = createBranchPayload({
      type: 'regenerate',
      branchName: `regenerate-${Date.now()}`,
      workflowId,
    })
    handleRegenerate(workflowId, regenerateBranchName, content)
  }, [canEdit, changeWorkflowInput, content, handleRegenerate, sessionId, workflowId])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setContent(message.content)
  }, [message.content])

  if (message.inputSource === 'desktop' && parseAskQuestionAnswerPayload(message.content)) {
    return null
  }

  return (
    <div className='group flex justify-end px-3 py-2'>
      <div className='max-w-[min(78%,720px)] space-y-1.5'>
        <div className='flex flex-wrap justify-end gap-2'>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              isWechatBotInput
                ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
                : 'border-border/60 bg-background/80 text-text-secondary'
            }`}
          >
            <SourceIcon size={12} strokeWidth={2.1} aria-hidden='true' />
            <span>{sourceLabel}</span>
          </span>
          {(isQueuedSteering || isAppliedSteering) && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                isQueuedSteering
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-primary/20 bg-primary/10 text-primary'
              }`}
            >
              <span>{isQueuedSteering ? 'Queued Steering' : 'Steering'}</span>
            </span>
          )}
        </div>
        <div
          className={`group-hover:border-border relative overflow-hidden rounded-2xl rounded-br-lg border px-5 py-4 text-[15px] leading-7 ${
            isQueuedSteering
              ? 'border-dashed border-amber-500/35 bg-amber-500/6'
              : 'border-border/70 bg-background'
          }`}
        >
          <div
            className={`absolute inset-y-4 right-0 w-1 rounded-full ${
              isQueuedSteering
                ? 'bg-amber-500/70'
                : isWechatBotInput
                  ? 'bg-emerald-500/65'
                  : 'bg-sky-500/45'
            }`}
          />
          {editing ? (
            <textarea
              aria-label='Edit Message'
              name='edited-message'
              autoComplete='off'
              className='border-border/70 focus:border-primary/45 focus:ring-primary/12 w-115 resize-none rounded-2xl border bg-transparent px-3 py-2 focus:ring-2'
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

        {isQueuedSteering ? (
          <div className='pr-1 text-right text-xs text-amber-700/90 dark:text-amber-300/90'>
            This message is queued for the next workflow checkpoint.
          </div>
        ) : null}

        <div className='flex justify-end pr-1 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100'>
          <UserInputMessageActions
            message={message}
            editing={editing}
            canEdit={canEdit}
            actions={{
              onEdit: handleEdit,
              onSave: handleSave,
              onCancel: handleCancel,
            }}
          />
        </div>
      </div>
    </div>
  )
}, areUserInputMessagePropsEqual)

function areUserInputMessagePropsEqual(prev: UserInputMessageProps, next: UserInputMessageProps) {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.inputSource === next.message.inputSource &&
    prev.message.kind === next.message.kind &&
    prev.message.pending === next.message.pending &&
    prev.workflowId === next.workflowId
  )
}

function UserInputMessageActions({
  message,
  actions,
  editing,
  canEdit,
}: {
  message: UserInputSessionMessage
  editing: boolean
  canEdit: boolean
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

            <span aria-live='polite' className='text-[11px] font-medium'>
              {copySuccess ? 'Copied' : 'Copy'}
            </span>
          </ActionButton>

          {canEdit ? (
            <ActionButton onClick={actions.onEdit}>
              <Pen size={13} strokeWidth={2.3} />
              <span className='text-[11px] font-medium'>Edit</span>
            </ActionButton>
          ) : null}
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
      className='text-text-secondary hover:border-border hover:bg-foreground/4 hover:text-foreground focus-visible:ring-primary/25 inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1.5 transition active:scale-95'
    >
      {children}
    </button>
  )
}
