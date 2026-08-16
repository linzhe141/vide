import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { forwardToElectronStore } from './forwardToElectronStore'
import type {
  GenerateImageConfig,
  LLMConfig,
  Theme,
  ThemeColor,
  WebSearchConfig,
  WechatBotConfig,
} from '@vide/config'

type State = {
  theme: Theme
  themeColor: ThemeColor
  llmConfig: LLMConfig
  generateImageConfig: GenerateImageConfig
  webSearchConfig: WebSearchConfig
  wechatBotConfig: WechatBotConfig
}

type Actions = {
  setTheme: (theme: Theme) => void
  setThemeColor: (themeColor: ThemeColor) => void
  setLLMConfig: (config: LLMConfig) => void
  setGenerateImageConfig: (config: GenerateImageConfig) => void
  setWebSearchConfig: (config: WebSearchConfig) => void
  setWechatBotConfig: (config: WechatBotConfig) => void
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
        setGenerateImageConfig: (config) => {
          set({ generateImageConfig: config })
        },
        setWebSearchConfig: (config) => {
          set({ webSearchConfig: config })
        },
        setWechatBotConfig: (config) => {
          set({ wechatBotConfig: config })
        },
      }),
      (data: any) => window.ipcRendererApi.invoke('dispatch-settings-store', data)
    )
  )
}
