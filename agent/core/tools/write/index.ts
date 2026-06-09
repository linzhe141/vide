import fs from 'fs/promises'
import path from 'path'
import { defineTool, ToolProvider } from '../toolProvider'
import { resolveWorkspacePath } from '../../workspace'
import { ToolCallError } from '../../error'

export const WRITE_TOOL_NAMES = {
  WRITE_FILE: `write-file`,
} as const

export class Write extends ToolProvider {
  writeFile = defineTool({
    name: WRITE_TOOL_NAMES.WRITE_FILE,
    type: 'function',
    function: {
      name: WRITE_TOOL_NAMES.WRITE_FILE,
      description: `
  Write content to a file.

  If the file exists it will be overwritten, otherwise a new file will be created.

  The path can be either absolute or relative.
  If the parent directory does not exist it will be created automatically.
  `,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (absolute or relative)',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },

    executor: async (args: any = {}) => {
      const { path: filePath, content } = args

      if (!filePath) {
        throw new ToolCallError('Path is required for writing a file')
      }

      try {
        const fullPath = resolveWorkspacePath(this.runtime.workspacePath, filePath)

        await fs.mkdir(path.dirname(fullPath), { recursive: true })
        await fs.writeFile(fullPath, content, 'utf8')

        const stats = await fs.stat(fullPath)

        return {
          reason: 'call-llm',
          result: {
            success: true,
            path: fullPath,
            size: stats.size,
            message: 'File written successfully',
          },
        }
      } catch (error: any) {
        console.log('write_file error', error)
        throw new ToolCallError(`Failed to write file: ${error.message}`)
      }
    },
  })

  getTools() {
    return [this.writeFile]
  }
}
