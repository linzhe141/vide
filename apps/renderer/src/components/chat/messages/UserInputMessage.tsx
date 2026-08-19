import type { UserInputSessionMessage, Workflow } from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'
import { Check, Copy, Monitor, MessageCircle, Pen, X } from 'lucide-react'
import { useEffect, useState, type PropsWithChildren } from 'react'
import { createBranchPayload } from '../SessionActions'
import { useChatContext } from '@/hooks/useChatContext'
import { useSessionStoreActions } from '../../../store/sessionStore'
import { parseAskQuestionAnswerPayload } from '../../../store/sessionStore/askQuestion'

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
  const isWechatBotInput = workflow.inputSource === 'wechat-bot'
  const sourceLabel = isWechatBotInput ? 'WeChat Bot' : 'Desktop'
  const SourceIcon = isWechatBotInput ? MessageCircle : Monitor
  if (workflow.inputSource === 'desktop' && parseAskQuestionAnswerPayload(message.content)) {
    return null
  }
  return (
    <div className='group flex justify-end px-3 py-2'>
      <div className='max-w-[min(78%,720px)] space-y-1.5'>
        <div className='flex justify-end'>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm ${
              isWechatBotInput
                ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
                : 'border-border/60 bg-background/80 text-text-secondary'
            }`}
          >
            <SourceIcon size={12} strokeWidth={2.1} />
            <span>{sourceLabel}</span>
          </span>
        </div>
        <div className='border-border/65 bg-background/92 group-hover:border-border relative overflow-hidden rounded-3xl rounded-br-lg border px-5 py-4 text-[15px] leading-7 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_42px_-24px_rgba(15,23,42,0.42)] dark:bg-white/4'>
          <div
            className={`absolute inset-y-4 right-0 w-1 rounded-full ${
              isWechatBotInput ? 'bg-emerald-500/65' : 'bg-sky-500/45'
            }`}
          />
          {editing ? (
            <textarea
              className='border-border/70 focus:border-primary/45 focus:ring-primary/12 w-115 resize-none rounded-2xl border bg-transparent px-3 py-2 outline-none focus:ring-2'
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
      className={`text-text-secondary hover:border-border hover:bg-foreground/4 hover:text-foreground flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1.5 transition-all duration-200 active:scale-95`}
    >
      {children}
    </button>
  )
}
