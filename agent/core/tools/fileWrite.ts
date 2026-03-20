import fs from 'fs/promises'
import path from 'path'
import type { Tool } from '@/agent/core/types'

export const fsWriteFile: Tool = {
  name: 'fs_write_file',
  type: 'function',
  function: {
    name: 'fs_write_file',
    description: `
Write content to a file.

If the file exists it will be overwritten, otherwise a new file will be created.

The path can be either absolute or relative.
If the parent directory does not exist it will be created automatically.

When generating code, it can be split into modules. Each code file should not exceed 300 lines.
When generating JavaScript code, it must be in ESM format.
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

  async executor(args: any = {}) {
    const { path: filePath, content } = args

    if (!filePath) {
      return {
        reason: 'call-llm',
        result: { success: false, error: 'Path is required' },
      }
    }

    try {
      const fullPath = path.resolve(filePath)

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
      return {
        reason: 'call-llm',
        result: {
          success: false,
          error: error.message,
        },
      }
    }
  },
}
