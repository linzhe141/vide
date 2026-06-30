import OpenAI from 'openai'

export type AI = OpenAI
export function createLLMClient(options: { apiKey: string; baseURL: string }) {
  return new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  })
}
