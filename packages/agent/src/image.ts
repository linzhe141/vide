import OpenAI from 'openai'

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
  if (!imageClient) {
    throw new Error('LLM client is not initialized. Please goto Generate Image Settings.')
  }
  const response = await imageClient.images.generate({
    model,
    prompt,
    n: 1, // 生成 1 张
    size: '2K', // 支持 1024x1024 / 2048x2048 / 1K / 2K{insert\_element\_3\_}
    response_format: 'url', // 返回 URL（也可 base64）
  })

  console.log('生成成功：', response.data![0].url)
  return response.data![0].url!
}
