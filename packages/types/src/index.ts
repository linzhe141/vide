export type Settings = {
  theme: 'dark' | 'light'
  themeColor: 'blue' | 'green' | 'orange'

  llmConfig: {
    apiKey: string
    baseUrl: string
    model: string
  }

  generateImageConfig: {
    apiKey: string
    baseUrl: string
    model: string
  }
}

export type Theme = Settings['theme']
export type ThemeColor = Settings['themeColor']
export type LLMConfig = Settings['llmConfig']
export type GenerateImageConfig = Settings['generateImageConfig']
