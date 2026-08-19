import { createContext, useContext } from 'react'

export type LinkMenuContextType = {
  activeLink: string
  setActiveLink: (link: string) => void
}

export const LinkMenuContext = createContext<LinkMenuContextType | undefined>(undefined)

export function useLinkMenu() {
  const context = useContext(LinkMenuContext)
  if (context === undefined) {
    throw new Error('useLinkMenu must be used within a Provider')
  }
  return context
}
