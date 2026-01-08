import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from 'react'

type ContextType = {
  activeLink: string
  setActiveLink: (link: string) => void
}

const Context = createContext<ContextType | undefined>(undefined)

export function Provider({ children }: PropsWithChildren) {
  const [activeLink, setActiveLink] = useState('')

  return (
    <Context.Provider value={{ activeLink, setActiveLink }}>
      {children}
    </Context.Provider>
  )
}

export function useLinkMenu() {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error('useLinkMenu must be used within a Provider')
  }
  return context
}
