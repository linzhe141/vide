import type { Settings } from '@vide/types'
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
  },
  name: 'settings',
  fileExtension: 'json',
})

export type SettingsStoreType = typeof settingsStore
