import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { forwardToElectronStore } from './forwardToElectronStore'
import type { LLMConfig, Theme } from '@/types'

type State = {
  theme: Theme
  llmConfig: LLMConfig
}

type Actions = {
  setTheme: (theme: Theme) => void
  setLLMConfig: (config: LLMConfig) => void
}

export let useElectronSettingStore: UseBoundStore<StoreApi<State & Actions>> = null!
export async function createElectronSettingStore() {
  const initState = await window.ipcRendererApi.invoke('get-store')
  useElectronSettingStore = create<State & Actions>(
    forwardToElectronStore(
      (set) => ({
        ...initState,
        setTheme: (theme) => {
          set({ theme })
        },
        setLLMConfig: (config) => {
          set({ llmConfig: config })
        },
      }),
      (data: any) => window.ipcRendererApi.invoke('dispatch-store', data)
    )
  )
}
