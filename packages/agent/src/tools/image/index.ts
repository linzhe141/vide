import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { defineTool, ToolProvider } from '../toolProvider'
import { createGenerateImageClient, generateImage as runGenerateImage } from '@vide/ai'
import { ToolCallError } from '../../error'
import { DEFAULT_VIDE_HOME } from '../../workspace'

export const Image_TOOL_NAMES = {
  GENERATE_IMAGE: `generate-image`,
} as const

const USER_ABORT_IMAGE_GENERATION_MESSAGE = 'User aborted image generation'
const GENERATED_IMAGES_DIR = path.join(DEFAULT_VIDE_HOME, 'generated-images')

const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

function isAbortLikeError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function getImageFileExtension(response: Response, remoteUrl: string) {
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()

  if (contentType && IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType]) {
    return IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType]
  }

  try {
    const extension = path.extname(new URL(remoteUrl).pathname)
    if (extension) {
      return extension.toLowerCase()
    }
  } catch {
    return '.png'
  }

  return '.png'
}

async function downloadGeneratedImage(remoteUrl: string, signal: AbortSignal) {
  const response = await fetch(remoteUrl, { signal })

  if (!response.ok) {
    throw new ToolCallError(
      `Failed to download generated image: ${response.status} ${response.statusText}`
    )
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer())
  const fileExtension = getImageFileExtension(response, remoteUrl)
  const fileName = `${Date.now()}-${randomUUID()}${fileExtension}`
  const localImagePath = path.join(GENERATED_IMAGES_DIR, fileName)

  await fs.mkdir(GENERATED_IMAGES_DIR, { recursive: true })
  await fs.writeFile(localImagePath, imageBuffer)

  return localImagePath
}

export class Image extends ToolProvider {
  generateImage = defineTool({
    name: Image_TOOL_NAMES.GENERATE_IMAGE,
    type: 'function',
    function: {
      name: Image_TOOL_NAMES.GENERATE_IMAGE,
      description: `
    Generate an image based on the provided prompt. The prompt should describe the desired content of the image in detail. The generated image will be downloaded to ~/.vide/generated-images and returned as a local file path.
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

      const remoteImageUrl = await new Promise<string>((resolve, reject) => {
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

      let imageUrl: string

      try {
        imageUrl = await downloadGeneratedImage(remoteImageUrl, this.runtime.signal)
      } catch (error) {
        if (this.runtime.signal.aborted || isAbortLikeError(error)) {
          throw new ToolCallError(USER_ABORT_IMAGE_GENERATION_MESSAGE)
        }

        throw error
      }

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
