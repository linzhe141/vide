import { useState } from 'react'
import { useChatContext } from './ChatProvider'

type Option = {
  label: string
  description?: string
  value: string
}

type Props = {
  args: {
    title: string
    description?: string
    type: 'single' | 'multiple'
    options: Option[]
  }
}

export function AskUserQuestionView({ args }: Props) {
  const { handleSend } = useChatContext()

  const [selected, setSelected] = useState<string[]>([])

  const toggle = (value: string) => {
    if (args.type === 'single') {
      setSelected([value])
    } else {
      setSelected((prev) =>
        prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
      )
    }
  }

  const submit = () => {
    const selectedOptions = args.options.filter((o) => selected.includes(o.value))

    const content = `
User selected option(s) for "${args.title}"

Selected:
${selectedOptions.map((o) => `- ${o.label}`).join('\n')}

Machine values:
${JSON.stringify(selectedOptions.map((o) => o.value))}
`

    handleSend(content.trim())
  }

  return (
    <div className='max-w-md space-y-3'>
      {/* title */}
      <div className='text-foreground text-sm font-semibold'>{args.title}</div>

      {/* description */}
      {args.description && <div className='text-muted-foreground text-xs'>{args.description}</div>}

      {/* options */}
      <div className='flex flex-col gap-2'>
        {args.options.map((opt) => {
          const checked = selected.includes(opt.value)

          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={`flex items-start gap-3 rounded-md border px-3 py-2 text-left transition ${
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
      <button
        onClick={submit}
        disabled={!selected.length}
        className='border-primary text-primary hover:bg-primary/10 w-full rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40'
      >
        Confirm
      </button>
    </div>
  )
}
