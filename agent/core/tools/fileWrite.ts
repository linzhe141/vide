import fs from 'fs/promises'
import path from 'path'
import type { Tool } from '@/agent/core/types'
const TARGET_DIR = path.resolve(process.cwd(), '.vide/artifacts')
export const fsWriteFile: Tool = {
  name: 'fs_write_file',
  type: 'function',
  function: {
    name: 'fs_write_file',
    description: `
Write content to a file.

⚠️ IMPORTANT:
ALL file paths MUST start with:

${TARGET_DIR}/

This is the ONLY directory you are allowed to write files to.

Examples:
- ${TARGET_DIR}/report.md
- ${TARGET_DIR}/slides/demo.md
- ${TARGET_DIR}/data/output.json

If the file exists it will be overwritten, otherwise a new file will be created.
`,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: `File path. MUST start with "${TARGET_DIR}/"`,
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
      return { success: false, error: 'Path is required' }
    }

    try {
      const fullPath = path.resolve(filePath)

      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, content, 'utf8')

      const stats = await fs.stat(fullPath)

      return {
        success: true,
        path: fullPath,
        size: stats.size,
        message: 'File written successfully',
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      }
    }
  },
}
