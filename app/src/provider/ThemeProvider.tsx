import { createContext, useContext, useState, type PropsWithChildren } from 'react'
import { useElectronSettingStore } from '../store/electronSettingStore'
import type { Theme } from '@/types'

export type ThemeColor = 'blue' | 'green' | 'orange'

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  themeColor: ThemeColor
  setThemeColor: (color: ThemeColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const themeColors = {
  blue: {
    light: 'oklch(0.55 0.22 250)',
    dark: 'oklch(0.6 0.22 250)',
  },
  green: {
    light: 'oklch(0.6 0.18 150)',
    dark: 'oklch(0.65 0.18 150)',
  },
  orange: {
    light: 'oklch(0.65 0.2 50)',
    dark: 'oklch(0.7 0.2 50)',
  },
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeColor, setThemeColor] = useState<ThemeColor>('blue')
  const { theme, setTheme } = useElectronSettingStore()
  function setThemeHandler(newTheme: Theme) {
    setTheme(newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const _applyThemeColor = (color: ThemeColor, dark: boolean) => {
    const colorValue = dark ? themeColors[color].dark : themeColors[color].light
    const root = document.documentElement

    root.style.setProperty('--primary', colorValue)
  }

  function setThemeColorHandler(color: ThemeColor) {
    setThemeColor(color)
    _applyThemeColor(color, theme === 'dark')
  }
  return (
    <ThemeContext.Provider
      value={{ theme, setTheme: setThemeHandler, themeColor, setThemeColor: setThemeColorHandler }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
