import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover } from '../Popover'
import { cn } from '../../lib/utils'
export interface SelectOption {
  element: React.ReactNode
  value: any
}

interface SelectProps {
  value?: string
  onChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
}: SelectProps) {
  const [open, setOpen] = React.useState(false)

  const selected = options.find((opt) => opt.value === value)

  const selectOptionsNode = options.map((o) => {
    const active = o.value === value
    return (
      <div
        key={o.value}
        onClick={() => {
          onChange?.(o.value)
          setOpen(false)
        }}
        className={cn(
          'hover:bg-foreground/5 cursor-pointer rounded px-2 py-1.5 text-sm',
          active && 'bg-foreground/10'
        )}
      >
        {o.element}
      </div>
    )
  })

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      reference={
        <button
          type='button'
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'border-border bg-background text-foreground hover:bg-foreground/5 flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm',
            className
          )}
        >
          <span className={cn(!selected && 'text-foreground/50', 'mr-2')}>
            {selected?.element ?? placeholder}
          </span>
          <ChevronDown className='h-4 w-4 opacity-60' />
        </button>
      }
      className='p-1'
    >
      <div className='flex flex-col'>{selectOptionsNode}</div>
    </Popover>
  )
}
