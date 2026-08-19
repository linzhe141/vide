import { useMemo, useState } from 'react'
import type {
  AskQuestionAnswer,
  AskUserQuestionSessionMessage,
  Workflow,
} from '@/store/sessionStore/types'
import { Check, ChevronLeft, ChevronRight, Circle, MessageSquareHeart, Send } from 'lucide-react'
import { useChatContext } from '@/hooks/useChatContext'
import { useSessionStoreActions, useSessionWorkflowNext } from '@/store/sessionStore'
import {
  ASK_QUESTION_ANSWER_TYPE,
  type AskQuestionAnswerPayload,
} from '@/store/sessionStore/askQuestion'

type AskUserQuestionMessageProps = {
  workflow: Workflow
  message: AskUserQuestionSessionMessage
}

const OTHER_VALUE = '__other__'

export function AskUserQuestionMessage({ workflow, message }: AskUserQuestionMessageProps) {
  const { handleSend, running, sessionId } = useChatContext()
  const { updateAskQuestionAnswer } = useSessionStoreActions()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sending, setSending] = useState(false)

  // 已提交判定：ask-question 属于某个 workflow，一旦用户提交答案就会产生下一个 workflow（子节点）。
  // 因此在 active branch 上「该 workflow 后面还有 workflow」= 已回答 → 只读展示。
  const nextWorkflow = useSessionWorkflowNext(sessionId, workflow.id)
  const hasNext = !!nextWorkflow
  const nextWorkflowInput = nextWorkflow?.input

  const readOnly = hasNext

  // 只读时，从下一个 workflow 的 input（提交答案的结构化 JSON）回显每个问题已选的内容。
  const displayQuestions = useMemo(() => {
    if (!hasNext || !nextWorkflowInput) return message.questions
    const payload = tryParseAnswerPayload(nextWorkflowInput)
    if (!payload) return message.questions
    return message.questions.map((q) => {
      const answer = payload.answers.find((a) => a.questionId === q.id)
      if (!answer) return q
      return {
        ...q,
        answer: { selected: answer.selected, ...(answer.other ? { other: answer.other } : {}) },
      }
    })
  }, [message.questions, hasNext, nextWorkflowInput])

  const question = displayQuestions[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = currentIndex === displayQuestions.length - 1

  const options = useMemo(
    () => [...(question?.options ?? []).slice(0, 3), { label: '其他', value: OTHER_VALUE }],
    [question]
  )

  if (!question) return null

  const selected = question.answer?.selected ?? ''
  const isOther = selected === OTHER_VALUE
  const otherText = question.answer?.other ?? ''

  const otherValid = (q: AskUserQuestionSessionMessage['questions'][number]) =>
    q.answer === null ||
    q.answer.selected !== OTHER_VALUE ||
    (q.answer.other?.trim().length ?? 0) > 0

  const allAnswered = displayQuestions.every((q) => q.answer !== null && otherValid(q))

  const canSubmit =
    !readOnly && !sending && !running && isLast && displayQuestions.length > 0 && allAnswered

  // 只读态仍允许翻看多题，但不能编辑/提交。
  const canGoNext =
    !isLast && (readOnly || (!running && question.answer !== null && otherValid(question)))
  const canGoPrev = !isFirst && (readOnly || !running)

  const saveAnswer = (answer: AskQuestionAnswer) => {
    updateAskQuestionAnswer({
      sessionId,
      workflowId: workflow.id,
      messageId: message.id,
      questionId: question.id,
      answer,
    })
  }

  const handleSelect = (value: string) => {
    if (readOnly || running || sending) return
    const next: AskQuestionAnswer = { selected: value }
    if (value !== OTHER_VALUE) saveAnswer(next)
    else saveAnswer({ ...next, other: '' })
  }

  const handleOtherChange = (value: string) => {
    if (readOnly || running || sending) return
    saveAnswer({ selected: OTHER_VALUE, other: value })
  }

  const goNext = () => {
    if (!canGoNext) return
    setCurrentIndex((i) => Math.min(i + 1, message.questions.length - 1))
  }

  const goPrev = () => {
    if (!canGoPrev) return
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }

  const describeAnswer = (q: AskUserQuestionSessionMessage['questions'][number]) => {
    if (!q.answer) return ''
    if (q.answer.selected === OTHER_VALUE) {
      return q.answer.other?.trim() ? `其他：${q.answer.other.trim()}` : '其他'
    }
    const option = q.options.find((o) => o.value === q.answer!.selected)
    return option?.label ?? q.answer.selected
  }

  const handleSubmit = () => {
    if (!canSubmit || readOnly) return

    const answers = message.questions.map((q) => ({
      questionId: q.id,
      title: q.title,
      selected: q.answer!.selected,
      ...(q.answer!.other ? { other: q.answer!.other } : {}),
    })) satisfies AskQuestionAnswerPayload['answers']
    const content = message.questions
      .map((q, index) => `${index + 1}. ${q.title}：${describeAnswer(q)}`)
      .join('\n')
    const payload = {
      type: ASK_QUESTION_ANSWER_TYPE,
      sessionId,
      workflowId: workflow.id,
      messageId: message.id,
      toolCallId: message.toolCallId,
      content: `用户回答了以下问题：\n${content}`,
      answers,
    }

    setSending(true)
    // handleSend 是 fire-and-forget（触发主进程后由全局事件驱动 UI），不 await。
    handleSend(JSON.stringify(payload))
    setSending(false)
  }

  return (
    <div className='border-border bg-background my-2 overflow-hidden rounded-3xl border p-4 shadow-sm'>
      <div className='mb-4 flex items-start gap-3'>
        <div className='bg-primary/12 text-primary mt-0.5 rounded-xl p-2'>
          <MessageSquareHeart size={18} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-text-info mb-1 flex items-center gap-2 text-[12px] font-medium'>
            <span>
              第 {currentIndex + 1} / {message.questions.length} 题
            </span>
          </div>
          <h3 className='text-foreground text-[15px] font-semibold'>{question.title}</h3>
          {question.description && (
            <p className='text-text-secondary mt-1 text-[13px] leading-6'>{question.description}</p>
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
              disabled={readOnly || sending || running}
              onClick={() => handleSelect(option.value)}
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

      {!readOnly && isOther && (
        <div className='mt-3'>
          <textarea
            value={otherText}
            onChange={(e) => handleOtherChange(e.target.value)}
            placeholder='请补充你的具体想法...'
            rows={3}
            className='border-border/80 bg-background/90 text-foreground placeholder:text-text-info focus:border-primary/55 focus:ring-primary/20 w-full resize-none rounded-2xl border px-3.5 py-2.5 text-[14px] leading-6 transition outline-none focus:ring-2'
          />
        </div>
      )}

      {readOnly ? (
        <div className='mt-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            {!isFirst && (
              <button
                type='button'
                onClick={goPrev}
                disabled={!canGoPrev}
                className='border-border/80 text-text-secondary inline-flex items-center gap-1 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45'
              >
                <ChevronLeft size={14} />
                上一个
              </button>
            )}
            {!isLast && (
              <button
                type='button'
                onClick={goNext}
                disabled={!canGoNext}
                className='border-border/80 text-text-secondary inline-flex items-center gap-1 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45'
              >
                下一个
                <ChevronRight size={14} />
              </button>
            )}
          </div>
          <div className='text-text-secondary text-[13px] font-medium'>✓ 已提交</div>
        </div>
      ) : (
        <div className='mt-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            {!isFirst && (
              <button
                type='button'
                onClick={goPrev}
                disabled={!canGoPrev}
                className='border-border/80 text-text-secondary hover:border-primary/45 hover:text-primary inline-flex items-center gap-1 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45'
              >
                <ChevronLeft size={14} />
                上一个
              </button>
            )}
            {!isLast && (
              <button
                type='button'
                onClick={goNext}
                disabled={!canGoNext}
                className='border-border/80 text-text-secondary hover:border-primary/45 hover:text-primary inline-flex items-center gap-1 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45'
              >
                下一个
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {isLast && (
            <button
              type='button'
              onClick={handleSubmit}
              disabled={!canSubmit}
              className='bg-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45'
            >
              <Send size={14} />
              {sending || running ? '发送中...' : '提交选择'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** 尝试把下一个 workflow 的 input 解析为「提交答案」的结构化 payload；否则返回 null。 */
function tryParseAnswerPayload(content: string): AskQuestionAnswerPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const payload = parsed as Partial<AskQuestionAnswerPayload>
  if (payload.type !== ASK_QUESTION_ANSWER_TYPE || !Array.isArray(payload.answers)) return null
  return payload as AskQuestionAnswerPayload
}
