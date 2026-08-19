import { createContext } from 'react'
import type { Theme } from '@vide/config'

export type ThemeColor = 'blue' | 'green' | 'orange'

export type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  themeColor: ThemeColor
  setThemeColor: (color: ThemeColor) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
