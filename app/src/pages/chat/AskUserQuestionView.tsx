import { useEffect, useMemo, useRef, useState } from 'react'
import { useChatContext } from './ChatProvider'
import { type ConversationBlock } from '../../store/threadStore'

export function AskUserQuestionView({ block }: { block: ConversationBlock }) {
  const askUser = useMemo(
    () =>
      block.askUser ?? {
        title: '',
        submitValue: [],
        description: '',
        completed: false,
        options: [],
        type: 'single',
      },
    [block.askUser]
  )

  const { handleSend } = useChatContext()

  const [selected, setSelected] = useState<string[]>(askUser.submitValue)
  const [submited, setSubmited] = useState(askUser.submitValue.length > 0)

  // 👇 用于检测变化
  const prevRef = useRef(askUser)

  const [animateTitle, setAnimateTitle] = useState(false)
  const [animateDesc, setAnimateDesc] = useState(false)
  const [newOptions, setNewOptions] = useState<string[]>([])

  useEffect(() => {
    const prev = prevRef.current

    if (prev.title !== askUser.title) {
      setAnimateTitle(true)
    }

    if (prev.description !== askUser.description) {
      setAnimateDesc(true)
    }

    // 👇 找新增 options
    if (askUser.options.length > prev.options.length) {
      const added = askUser.options.slice(prev.options.length)
      setNewOptions(added.map((o) => o.value))
    }

    prevRef.current = askUser
  }, [askUser])

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
    <div
      className={`my-4 max-w-md space-y-4 transition ${
        !askUser.completed ? 'animate-pulse-soft opacity-60' : ''
      }`}
    >
      {/* title */}
      {askUser.title && (
        <div className={`text-sm font-semibold ${animateTitle ? 'animate-pop' : ''}`}>
          {askUser.title}
        </div>
      )}

      {/* description */}
      {askUser.description && (
        <div className={`text-text-secondary text-xs ${animateDesc ? 'animate-pop delay-75' : ''}`}>
          {askUser.description}
        </div>
      )}

      {/* options */}
      <div className='flex flex-col gap-2'>
        {askUser.options.map((opt, index) => {
          const checked = selected.includes(opt.value)
          const isNew = newOptions.includes(opt.value)

          return (
            <button
              key={opt.value}
              disabled={submited || !askUser.completed}
              onClick={() => toggle(opt.value)}
              className={`group flex items-start gap-3 rounded-md border px-3 py-2 text-left transition-all duration-200 disabled:cursor-not-allowed ${
                checked ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/40'
              } ${isNew ? 'animate-pop' : ''} `}
              style={{
                animationDelay: `${index * 40}ms`,
              }}
            >
              {/* radio */}
              <div
                className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border transition-all ${checked ? 'border-primary' : 'border-text-secondary'} `}
              >
                {checked && <div className='bg-primary h-2 w-2 rounded-full' />}
              </div>

              <div>
                <div className='text-sm'>{opt.label}</div>

                {opt.description && (
                  <div className='text-text-secondary text-xs'>{opt.description}</div>
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
          className='border-border hover:bg-foreground/5 w-full rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40'
        >
          Confirm
        </button>
      )}
    </div>
  )
}
