import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router'
import { cn } from '../../lib/utils'
import { useLinkMenu } from './provider'

interface LinkMenuItemProps {
  label: string
  link: string
  className?: string
}

export function LinkMenuItem({
  label,
  link,
  className,
}: PropsWithChildren<LinkMenuItemProps>) {
  const { setActiveLink, activeLink } = useLinkMenu()
  const isActive = activeLink === link
  return (
    <NavLink
      to={link}
      className={cn(
        'block w-full rounded-md p-2 hover:bg-[#e9e9e9]/90 dark:hover:bg-[#262626]/90',
        {
          'text-foreground bg-[#e9e9e9] dark:bg-[#262626]': isActive,
          'text-text-secondary': !isActive,
        },
        className
      )}
      onClick={() => setActiveLink(link)}
    >
      <div className='flex items-center'>{label}</div>
    </NavLink>
  )
}
