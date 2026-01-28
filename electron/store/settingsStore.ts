import ElectronStore from 'electron-store'
export type Settings = {
  theme: 'dark' | 'light'
  themeColor: 'blue' | 'green' | 'orange'
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
    themeColor: 'blue',

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
