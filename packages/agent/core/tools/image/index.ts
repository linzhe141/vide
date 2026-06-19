import { defineTool, ToolProvider } from '../toolProvider'
import { generateImage } from '../../image'
import { ToolCallError } from '../../error'

export const Image_TOOL_NAMES = {
  GENERATE_IMAGE: `generate-image`,
} as const

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

    async executor(args: any = {}) {
      const { prompt } = args

      if (!prompt) {
        throw new ToolCallError('Prompt is required for image generation')
      }

      const imageUrl = await generateImage(prompt)
      return {
        reason: 'call-llm',
        result: { url: imageUrl },
      }
    },
  })

  getTools() {
    return [this.generateImage]
  }
}
