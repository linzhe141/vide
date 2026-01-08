import { cn } from '@/app/src/lib/utils'
import * as React from 'react'

type ButtonVariant = 'solid' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const baseClass =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none'

const variantClassMap: Record<ButtonVariant, string> = {
  solid: `
    bg-primary text-background
    hover:bg-primary/90
  `,
  outline: `
    border border-border
    bg-background text-foreground
    hover:bg-foreground/5
  `,
  ghost: `
    bg-transparent text-foreground
    hover:bg-foreground/5
  `,
}

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({
  className,
  variant = 'solid',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        baseClass,
        variantClassMap[variant],
        sizeClassMap[size],
        className
      )}
      {...props}
    />
  )
}
