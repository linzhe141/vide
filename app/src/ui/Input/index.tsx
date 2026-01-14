import * as React from 'react'
import { cn } from '../../lib/utils'

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'bg-background border-border w-full rounded border px-3 py-2 text-sm',
        'placeholder:text-foreground/40',
        'focus:ring-primary/50 focus:border-primary focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
