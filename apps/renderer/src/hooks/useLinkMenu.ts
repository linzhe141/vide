import { useContext } from 'react'
import { LinkMenuContext } from './linkMenuContext'

export function useLinkMenu() {
  const context = useContext(LinkMenuContext)
  if (context === undefined) {
    throw new Error('useLinkMenu must be used within a Provider')
  }
  return context
}
