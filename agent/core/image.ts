import OpenAI from 'openai'
import { AbortError } from './error'

let model: string = null!
export let imageClient: OpenAI = null!

export function createGenerateImageClient(options: {
  apiKey: string
  baseURL: string
  model: string
}) {
  imageClient = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
  })
  model = options.model
}

export async function generateImage(prompt: string) {
  try {
    const response = await imageClient.images.generate({
      model,
      prompt,
      n: 1, // 生成 1 张
      // @ts-expect-error 这是其他厂商的参数
      size: '2K', // 支持 1024x1024 / 2048x2048 / 1K / 2K{insert\_element\_3\_}
      response_format: 'url', // 返回 URL（也可 base64）
    })

    console.log('生成成功：', response.data![0].url)
    return response.data![0].url
  } catch (error) {
    if (error instanceof OpenAI.APIUserAbortError && error.name === 'AbortError') {
      console.error('Stream was aborted by user')
      // 统一抛出 AbortError，方便上层捕获和处理
      throw new AbortError()
    }
    console.error('Error in processLLMStream:', error)
    // 其他错误继续往上抛
    throw error
  }
}
