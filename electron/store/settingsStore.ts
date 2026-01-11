import ElectronStore from 'electron-store'
export type Settings = {
  theme: 'dark' | 'light'

  windowState: {
    height: number
    width: number
    x: number
    y: number
  } | null

  llmConfig: {
    apiKey: string
    baseUrl: string
    model: string
  }
}
export const settingsStore = new ElectronStore<Settings>({
  defaults: {
    theme: 'dark',
    windowState: null,
    llmConfig: {
      apiKey: '',
      baseUrl: '',
      model: '',
    },
  },
  name: 'settings',
  fileExtension: 'json',
})

export type SettingsStoreType = typeof settingsStore
