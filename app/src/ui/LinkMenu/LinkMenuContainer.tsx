import { useEffect, type PropsWithChildren } from 'react'
import { cn } from '@/app/src/lib/utils'
import { useLinkMenu } from './provider'

interface LinkMenuContainerProps {
  defaultLink: string
  className?: string
}
export function LinkMenuContainer({
  className,
  defaultLink,
  children,
}: PropsWithChildren<LinkMenuContainerProps>) {
  const { setActiveLink } = useLinkMenu()

  useEffect(() => {
    setActiveLink(defaultLink)
  }, [setActiveLink, defaultLink])

  return <div className={cn('space-y-2', className)}>{children}</div>
}
