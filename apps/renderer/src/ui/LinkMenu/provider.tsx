import { useState, type PropsWithChildren } from 'react'
import { LinkMenuContext } from '@/hooks/linkMenuContext'

export function Provider({ children }: PropsWithChildren) {
  const [activeLink, setActiveLink] = useState('')

  return (
    <LinkMenuContext.Provider value={{ activeLink, setActiveLink }}>
      {children}
    </LinkMenuContext.Provider>
  )
}
