import type { Settings } from '@vide/config'
import ElectronStore from 'electron-store'

export const settingsStore = new ElectronStore<Settings>({
  defaults: {
    theme: 'dark',
    themeColor: 'blue',

    llmConfig: {
      apiKey: '',
      baseUrl: '',
      model: '',
    },
    generateImageConfig: {
      apiKey: '',
      baseUrl: '',
      model: '',
    },
    webSearchConfig: {
      apiKey: '',
      searchUrl: '',
    },
  },
  name: 'settings',
  fileExtension: 'json',
})

export type SettingsStoreType = typeof settingsStore
