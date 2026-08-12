import { useMemo, useState } from 'react'
import type { AskUserQuestionSessionMessage, Workflow } from '@/store/sessionStore/types'
import { Check, Circle, MessageSquareHeart, Send } from 'lucide-react'
import { useChatContext } from '../ChatProvider'
import { useSessionStoreActions } from '@/store/sessionStore'

type AskUserQuestionMessageProps = {
  workflow: Workflow
  message: AskUserQuestionSessionMessage
}

const OTHER_VALUE = '__other__'

export function AskUserQuestionMessage({ workflow, message }: AskUserQuestionMessageProps) {
  const { handleSend, running, sessionId } = useChatContext()
  const { updateAskQuestionAnswer } = useSessionStoreActions()
  const [selected, setSelected] = useState<string>(message.options[0]?.value ?? '')
  const [other, setOther] = useState('')
  const [sending, setSending] = useState(false)

  const options = useMemo(
    () => [...message.options.slice(0, 3), { label: '其他', value: OTHER_VALUE }],
    [message.options]
  )

  const isOther = selected === OTHER_VALUE
  const canSubmit =
    !sending &&
    !running &&
    message.answer === null &&
    selected.length > 0 &&
    (!isOther || other.trim().length > 0)

  const handleSubmit = async () => {
    if (!canSubmit) return

    const selectedValue = isOther ? OTHER_VALUE : selected
    const nextAnswer: AskUserQuestionSessionMessage['answer'] = {
      selected: selectedValue,
      ...(isOther ? { other: other.trim() } : {}),
    }
    const payload = {
      message: 'ask-user-question-answer',
      content: `用户已经选择了：${isOther ? `other:${other.trim()}` : selectedValue}`,
      selected: selectedValue,
      ...(isOther ? { other: other.trim() } : {}),
    }

    setSending(true)
    try {
      updateAskQuestionAnswer({
        sessionId,
        workflowId: workflow.id,
        messageId: message.id,
        answer: nextAnswer,
      })
      await handleSend(JSON.stringify(payload))
    } catch (error) {
      updateAskQuestionAnswer({
        sessionId,
        workflowId: workflow.id,
        messageId: message.id,
        answer: null,
      })
      throw error
    } finally {
      setSending(false)
    }
  }

  return (
    <div className='border-border bg-background my-2 overflow-hidden rounded-3xl border p-4 shadow-sm'>
      <div className='mb-4 flex items-start gap-3'>
        <div className='bg-primary/12 text-primary mt-0.5 rounded-xl p-2'>
          <MessageSquareHeart size={18} />
        </div>
        <div className='min-w-0'>
          <h3 className='text-foreground text-[15px] font-semibold'>{message.title}</h3>
          {message.description && (
            <p className='text-text-secondary mt-1 text-[13px] leading-6'>{message.description}</p>
          )}
        </div>
      </div>

      <div className='space-y-2.5'>
        {options.map((option) => {
          const active = selected === option.value
          return (
            <button
              key={option.value}
              type='button'
              disabled={sending || running || message.answer !== null}
              onClick={() => setSelected(option.value)}
              className={`group w-full rounded-2xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                active
                  ? 'border-primary/60 bg-primary/8'
                  : 'border-border/80 bg-background/75 hover:border-primary/45 hover:bg-primary/6'
              }`}
            >
              <div className='flex items-center gap-2.5'>
                <span className='text-primary'>
                  {active ? (
                    <Check size={18} strokeWidth={2.8} />
                  ) : (
                    <Circle size={16} strokeWidth={1.9} />
                  )}
                </span>
                <span className='text-foreground text-[14px] font-medium'>{option.label}</span>
              </div>
            </button>
          )
        })}
      </div>

      {isOther && (
        <div className='mt-3'>
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder='请补充你的具体想法...'
            rows={3}
            className='border-border/80 bg-background/90 text-foreground placeholder:text-text-info focus:border-primary/55 focus:ring-primary/20 w-full resize-none rounded-2xl border px-3.5 py-2.5 text-[14px] leading-6 transition outline-none focus:ring-2'
          />
        </div>
      )}

      <div className='mt-4 flex justify-end'>
        <button
          type='button'
          onClick={handleSubmit}
          disabled={!canSubmit}
          className='bg-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45'
        >
          <Send size={14} />
          {sending || running ? '发送中...' : '提交选择'}
        </button>
      </div>
    </div>
  )
}
