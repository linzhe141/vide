import { useEffect, useState } from 'react'
import { useChatContext } from './ChatProvider'
import { useSessionStoreActions } from '../../store/sessionStore'
import { cn } from '../../lib/utils'
import type { SessionMessage } from '../../store/sessionStore/types'

export const AskUserQuestionUserSlectedReultPrefix = 'AskUserQuestionUserSlectedReult'
export function AskUserQuestionView({
  blockId,
  message,
}: {
  blockId: string
  message: Extract<SessionMessage, { role: 'ask-user' }>
}) {
  const { handleSend, sessionId } = useChatContext()
  const [selected, setSelected] = useState<string[]>(message.submitValue)
  const [submited, setSubmited] = useState(message.submitValue.length > 0)
  const { updateAskUserSubmitValue } = useSessionStoreActions()
  useEffect(() => {
    setSelected(message.submitValue)
    setSubmited(message.submitValue.length > 0)
  }, [message.submitValue])

  const toggle = (value: string) => {
    if (message.type === 'single') {
      setSelected([value])
      return
    }

    setSelected((prev) => {
      const next = prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
      return next
    })
  }

  const submit = () => {
    setSubmited(true)
    updateAskUserSubmitValue(sessionId, blockId, message.id, selected)

    const selectedOptions = message.options.filter((option) => selected.includes(option.value))

    const content = `${AskUserQuestionUserSlectedReultPrefix}
User selected option(s) for "${message.title}"
Selected:
${selectedOptions.map((option) => `- ${option.label}`).join('\n')}
Machine values:
${JSON.stringify(selectedOptions.map((option) => option.value))}
`

    handleSend(content.trim())

    window.ipcRendererApi.invoke('ask-user-question-submit', {
      submitValue: selected,
      workflowId: blockId,
    })
  }

  return (
    <div
      className={`my-4 max-w-md space-y-4 transition ${!message.completed ? 'animate-pulse-soft opacity-60' : ''}`}
    >
      {message.title && <div className='text-sm font-semibold'>{message.title}</div>}

      {message.description && (
        <div className='text-text-secondary text-xs'>{message.description}</div>
      )}

      <div className='flex flex-col gap-2'>
        {message.options.map((option) => {
          const checked = selected.includes(option.value)

          return (
            <button
              key={option.value}
              disabled={submited || !message.completed}
              onClick={() => toggle(option.value)}
              className={`group flex items-start gap-3 rounded-md border px-3 py-2 text-left transition-all duration-200 disabled:cursor-not-allowed ${
                checked ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/40'
              }`}
            >
              <div
                className={`mt-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border transition-all ${
                  checked ? 'border-primary' : 'border-text-secondary'
                }`}
              >
                {checked && <div className='bg-primary h-2 w-2 rounded-full' />}
              </div>

              <div>
                <div className='text-sm'>{option.label}</div>
                {option.description && (
                  <div className='text-text-secondary text-xs'>{option.description}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {message.completed && (
        <button
          onClick={submit}
          disabled={!selected.length || submited}
          className={cn(
            'border-border w-full rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40',
            !selected.length || submited ? 'cursor-not-allowed' : 'hover:bg-foreground/5'
          )}
        >
          Confirm
        </button>
      )}
    </div>
  )
}
