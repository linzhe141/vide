import { createContext } from 'react'

export type LinkMenuContextType = {
  activeLink: string
  setActiveLink: (link: string) => void
}

export const LinkMenuContext = createContext<LinkMenuContextType | undefined>(undefined)
