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

type ElectronSettingStore = State & Actions

export let useElectronSettingStore: UseBoundStore<StoreApi<ElectronSettingStore>> = null!
export async function createElectronSettingStore() {
  const initState = await window.ipcRendererApi.invoke('get-settings-store')
  useElectronSettingStore = create<ElectronSettingStore>(
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

export const useThemeSetting = () => useElectronSettingStore((state) => state.theme)

export const useSetTheme = () => useElectronSettingStore((state) => state.setTheme)

export const useThemeColorSetting = () => useElectronSettingStore((state) => state.themeColor)

export const useSetThemeColor = () => useElectronSettingStore((state) => state.setThemeColor)

export const useLLMConfig = () => useElectronSettingStore((state) => state.llmConfig)

export const useSetLLMConfig = () => useElectronSettingStore((state) => state.setLLMConfig)

export const useGenerateImageConfig = () =>
  useElectronSettingStore((state) => state.generateImageConfig)

export const useSetGenerateImageConfig = () =>
  useElectronSettingStore((state) => state.setGenerateImageConfig)

export const useWebSearchConfig = () => useElectronSettingStore((state) => state.webSearchConfig)

export const useSetWebSearchConfig = () =>
  useElectronSettingStore((state) => state.setWebSearchConfig)

export const useWechatBotConfig = () => useElectronSettingStore((state) => state.wechatBotConfig)

export const useSetWechatBotConfig = () =>
  useElectronSettingStore((state) => state.setWechatBotConfig)
