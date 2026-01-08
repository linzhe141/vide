import * as React from 'react'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'

type AlertVariant = 'info' | 'success' | 'warn' | 'fail'

interface AlertProps extends React.ComponentProps<'div'> {
  variant?: AlertVariant
}

const baseClass =
  'w-full rounded-md border px-4 py-3 text-sm flex items-start gap-2'

const variantClassMap: Record<AlertVariant, string> = {
  info: `
    border-border
    bg-background
    text-foreground
  `,
  success: `
    border-emerald-500/30
    bg-emerald-500/10
    text-foreground
  `,
  warn: `
    border-amber-500/30
    bg-amber-500/10
    text-foreground
  `,
  fail: `
    border-red-500/30
    bg-red-500/10
    text-foreground
  `,
}

const iconMap: Partial<Record<AlertVariant, React.ReactNode>> = {
  success: <CheckCircle2 className='mt-0.5 h-4 w-4 text-emerald-500' />,
  warn: <AlertTriangle className='mt-0.5 h-4 w-4 text-amber-500' />,
  fail: <XCircle className='mt-0.5 h-4 w-4 text-red-500' />,
}

export function Alert({
  className,
  variant = 'info',
  children,
  ...props
}: AlertProps) {
  const icon = iconMap[variant]

  return (
    <div
      className={cn(baseClass, variantClassMap[variant], className)}
      {...props}
    >
      {icon}
      <div className='flex-1 leading-relaxed'>{children}</div>
    </div>
  )
}
