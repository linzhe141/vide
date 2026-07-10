import fs from 'fs/promises'
import path from 'path'
import { defineTool, ToolProvider } from './toolProvider'
import { resolveWorkspacePath } from './../workspace'
import { ToolCallError } from './../error'

export const READ_TOOL_NAMES = {
  READ_FILE: 'read-file',
} as const

const CONFIG = {
  MAX_FILE_SIZE: 1024 * 1024, // 1MB
  ENABLE_PATH_RESTRICTION: false,
  FS_ROOT: process.cwd(),
}

export class Read extends ToolProvider {
  readFile = defineTool({
    name: READ_TOOL_NAMES.READ_FILE,
    type: 'function',
    function: {
      name: READ_TOOL_NAMES.READ_FILE,
      description: `
Read file content by path. Supports absolute and relative paths. Returns up to 1MB content.
- The path can be absolute or relative to the workspace root.
- Automatically handles encoding detection and fallback to base64 if necessary.
- For large files, only the first 1MB is returned with a truncation flag.
      `.trim(),
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (absolute or relative)',
          },
          encoding: {
            type: 'string',
            enum: ['utf8', 'base64', 'hex'],
            default: 'utf8',
            description: 'Encoding to use when reading the file. Defaults to utf8.',
          },
        },
        required: ['path'],
      },
    },

    executor: async (args: any = {}) => {
      const { path: filePath, encoding = 'utf8' } = args

      if (!filePath) {
        throw new ToolCallError('Path is required for reading a file')
      }

      try {
        const result = await this.readFileSmart(filePath, encoding)
        return { reason: 'call-llm', result }
      } catch (error: any) {
        console.log('read_file error', error)
        throw new ToolCallError(`Failed to read file: ${error.message}`)
      }
    },
  })

  /** 核心文件读取逻辑 */
  private async readFileSmart(filePath: string, encoding: BufferEncoding = 'utf8') {
    const fullPath = resolveWorkspacePath(this.runtime.workspacePath, filePath)

    this.assertPathAllowed(fullPath)

    const stat = await fs.stat(fullPath)

    if (!stat.isFile()) {
      throw new Error('Target is not a file')
    }

    const buffer = await fs.readFile(fullPath)

    let truncated = false
    let finalBuffer = buffer

    if (buffer.length > CONFIG.MAX_FILE_SIZE) {
      truncated = true
      finalBuffer = buffer.slice(0, CONFIG.MAX_FILE_SIZE)
    }

    let content: string
    let finalEncoding = encoding

    try {
      content = finalBuffer.toString(encoding)
    } catch {
      // Fallback to base64 for binary-safe reading
      content = finalBuffer.toString('base64')
      finalEncoding = 'base64'
    }

    return {
      path: filePath,
      resolvedPath: fullPath,
      encoding: finalEncoding,
      size: stat.size,
      sizeFormatted: this.formatBytes(stat.size),
      truncated,
      content,
    }
  }

  /** 路径权限验证 */
  private assertPathAllowed(resolvedPath: string) {
    if (!CONFIG.ENABLE_PATH_RESTRICTION) return

    const root = path.resolve(CONFIG.FS_ROOT)
    if (!resolvedPath.startsWith(root)) {
      throw new Error('Access denied: path is outside allowed root')
    }
  }

  /** 格式化文件大小 */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  getTools() {
    return [this.readFile]
  }
}
