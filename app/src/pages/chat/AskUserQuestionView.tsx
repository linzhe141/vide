import { useState } from 'react'
import { useChatContext } from './ChatProvider'
import { type ConversationBlock } from '../../store/threadStore'

export function AskUserQuestionView({ block }: { block: ConversationBlock }) {
  const askUser = block.askUser ?? {
    title: '',
    submitValue: [],
    description: '',
    completed: false,
    options: [],
    type: 'single',
  }
  const { handleSend } = useChatContext()

  const [selected, setSelected] = useState<string[]>(askUser.submitValue)
  const [submited, setSubmited] = useState(askUser.submitValue.length > 0)

  const toggle = (value: string) => {
    if (askUser.type === 'single') {
      setSelected([value])
    } else {
      setSelected((prev) =>
        prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
      )
    }
  }

  const submit = () => {
    setSubmited(true)
    const selectedOptions = askUser.options.filter((o) => selected.includes(o.value))

    const content = `
User selected option(s) for "${askUser.title}"
Selected:
${selectedOptions.map((o) => `- ${o.label}`).join('\n')}
Machine values:
${JSON.stringify(selectedOptions.map((o) => o.value))}
`

    handleSend(content.trim())
    window.ipcRendererApi.invoke('ask-user-question-submit', {
      submitValue: selected,
      workflowId: block.id,
    })
  }
  return (
    <div className='my-3 max-w-md space-y-3'>
      {/* title */}
      <div className='text-foreground text-sm font-semibold'>{askUser.title}</div>

      {/* description */}
      {askUser.description && (
        <div className='text-muted-foreground text-xs'>{askUser.description}</div>
      )}

      {/* options */}
      <div className='flex flex-col gap-2'>
        {askUser.options.map((opt) => {
          const checked = selected.includes(opt.value)

          return (
            <button
              key={opt.value}
              disabled={submited || !askUser.completed}
              onClick={() => toggle(opt.value)}
              className={`flex items-start gap-3 rounded-md border px-3 py-2 text-left transition disabled:cursor-not-allowed ${
                checked ? 'border-primary' : 'border-border hover:border-muted-foreground'
              } `}
            >
              {/* radio indicator */}
              <div
                className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border ${checked ? 'border-primary' : 'border-muted-foreground'} `}
              >
                {checked && <div className='bg-primary h-2 w-2 rounded-full' />}
              </div>

              <div>
                <div className='text-foreground text-sm font-medium'>{opt.label}</div>

                {opt.description && (
                  <div className='text-muted-foreground text-xs'>{opt.description}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* submit */}
      {askUser.completed && (
        <button
          onClick={submit}
          disabled={!selected.length || submited}
          className='border-primary text-primary hover:bg-primary/10 w-full rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40'
        >
          Confirm
        </button>
      )}
    </div>
  )
}
