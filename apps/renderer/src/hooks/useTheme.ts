import { createContext, useContext } from 'react'
import type { Theme } from '@vide/config'

export type ThemeColor = 'blue' | 'green' | 'orange'

export type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  themeColor: ThemeColor
  setThemeColor: (color: ThemeColor) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
