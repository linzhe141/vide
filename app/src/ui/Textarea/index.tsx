import * as React from 'react'
import { cn } from '../../lib/utils'

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'bg-background border-border w-full rounded border px-3 py-2 text-sm',
        'placeholder:text-foreground/40',
        'focus:ring-primary/50 focus:border-primary focus:ring-2 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'min-h-[80px] resize-y',
        className
      )}
      {...props}
    />
  )
}
