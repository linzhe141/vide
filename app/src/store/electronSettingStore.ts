import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { forwardToElectronStore } from './forwardToElectronStore'
import type { LLMConfig, Theme, ThemeColor } from '@/types'

type State = {
  theme: Theme
  themeColor: ThemeColor
  llmConfig: LLMConfig
}

type Actions = {
  setTheme: (theme: Theme) => void
  setThemeColor: (themeColor: ThemeColor) => void
  setLLMConfig: (config: LLMConfig) => void
}

export let useElectronSettingStore: UseBoundStore<StoreApi<State & Actions>> = null!
export async function createElectronSettingStore() {
  const initState = await window.ipcRendererApi.invoke('get-settings-store')
  useElectronSettingStore = create<State & Actions>(
    forwardToElectronStore(
      (set) => ({
        ...initState,
        setTheme: (theme) => {
          set({ theme })
        },
        setThemeColor: (themeColor) => {
          set({ themeColor })
        },
        setLLMConfig: (config) => {
          set({ llmConfig: config })
        },
      }),
      (data: any) => window.ipcRendererApi.invoke('dispatch-settings-store', data)
    )
  )
}
