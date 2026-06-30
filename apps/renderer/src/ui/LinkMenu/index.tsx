import type { PropsWithChildren } from 'react'
import { Provider } from './provider'
import { LinkMenuContainer } from './LinkMenuContainer'

interface LinkMenuProps {
  defaultLink: string
  className?: string
}
export function LinkMenu({ className, defaultLink, children }: PropsWithChildren<LinkMenuProps>) {
  return (
    <Provider>
      <LinkMenuContainer defaultLink={defaultLink} className={className}>
        {children}
      </LinkMenuContainer>
    </Provider>
  )
}
