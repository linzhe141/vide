import { defineTool, ToolProvider } from '../toolProvider'
import { createGenerateImageClient, generateImage as runGenerateImage } from '@vide/ai'
import { ToolCallError } from '../../error'

export const Image_TOOL_NAMES = {
  GENERATE_IMAGE: `generate-image`,
} as const

const USER_ABORT_IMAGE_GENERATION_MESSAGE = 'User aborted image generation'

function isAbortLikeError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

export class Image extends ToolProvider {
  generateImage = defineTool({
    name: Image_TOOL_NAMES.GENERATE_IMAGE,
    type: 'function',
    function: {
      name: Image_TOOL_NAMES.GENERATE_IMAGE,
      description: `
Generate an image based on the provided prompt. The prompt should describe the desired content of the image in detail. The generated image will be returned as a URL that can be accessed to view or download the image.
Example prompt: "A serene landscape with mountains in the background, a clear blue lake in the foreground, and a vibrant sunset sky."
  `,
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Prompt for image generation',
          },
        },
        required: ['prompt'],
      },
    },

    executor: async (args: any = {}) => {
      const { prompt } = args
      const { generateImageConfig } = this.runtime.agentSettings

      if (!prompt) {
        throw new ToolCallError('Prompt is required for image generation')
      }

      if (
        !generateImageConfig?.apiKey ||
        !generateImageConfig?.baseUrl ||
        !generateImageConfig?.model
      ) {
        throw new ToolCallError(
          'Generate image settings are incomplete. Please configure API Key, Base URL, and Model first.'
        )
      }

      const client = createGenerateImageClient({
        apiKey: generateImageConfig.apiKey,
        baseURL: generateImageConfig.baseUrl,
        model: generateImageConfig.model,
      })

      const imageUrl = await new Promise<string>((resolve, reject) => {
        let settled = false

        const cleanup = () => {
          this.runtime.signal.removeEventListener('abort', abortHandler)
        }

        const rejectWithAbort = () => {
          if (settled) return
          settled = true
          cleanup()
          reject(new ToolCallError(USER_ABORT_IMAGE_GENERATION_MESSAGE))
        }

        const abortHandler = () => {
          rejectWithAbort()
        }

        if (this.runtime.signal.aborted) {
          rejectWithAbort()
          return
        }

        this.runtime.signal.addEventListener('abort', abortHandler, { once: true })

        runGenerateImage(prompt, {
          client,
          model: generateImageConfig.model,
          signal: this.runtime.signal,
        })
          .then((url) => {
            if (settled) return
            settled = true
            cleanup()
            resolve(url)
          })
          .catch((error) => {
            if (settled) return
            settled = true
            cleanup()

            if (this.runtime.signal.aborted || isAbortLikeError(error)) {
              reject(new ToolCallError(USER_ABORT_IMAGE_GENERATION_MESSAGE))
              return
            }

            reject(error)
          })
      })

      return {
        reason: 'call-llm',
        result: { url: imageUrl, content: 'successful generation' },
      }
    },
  })

  getTools() {
    return [this.generateImage]
  }
}
