import fs from 'fs/promises'
import path from 'path'
import { defineTool, ToolProvider } from '../toolProvider'
import { resolveWorkspacePath } from '../../workspace'
import { ToolCallError } from '../../error'

export const WRITE_TOOL_NAMES = {
  WRITE_FILE: `write-file`,
  APPEND_FILE: `append-file`,
} as const

const MAX_WRITE_CONTENT_LENGTH = 1000

export class Write extends ToolProvider {
  writeFile = defineTool({
    name: WRITE_TOOL_NAMES.WRITE_FILE,
    type: 'function',
    function: {
      name: WRITE_TOOL_NAMES.WRITE_FILE,
      description: `
Write a complete file in one operation.
- If the file exists, it will be overwritten; otherwise a new file will be created.
- The parent directory will be created automatically if it does not exist.
- ⚠️ This tool is only suitable for **small files** (content typically ≤ ${MAX_WRITE_CONTENT_LENGTH} characters).
  If your content is longer, you must split it into chunks and use the \`append-file\` tool multiple times,
  then the final result will be a complete file.
- The path can be absolute or relative.
      `.trim(),
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (absolute or relative)',
          },
          content: {
            type: 'string',
            description: `Entire file content. Must not exceed ~${MAX_WRITE_CONTENT_LENGTH} characters. For larger content, use append-file.`,
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
      if (typeof content !== 'string') {
        throw new ToolCallError('Content must be a string')
      }

      // 内容过长时拒绝执行，防止 LLM 输出截断
      if (content.length > MAX_WRITE_CONTENT_LENGTH) {
        throw new ToolCallError(
          `Content is too long (${content.length} characters). Maximum allowed is ${MAX_WRITE_CONTENT_LENGTH}. ` +
            `Please use the \`append-file\` tool to write the file in smaller chunks.`
        )
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

  /** 大文件分块追加写入 */
  appendFile = defineTool({
    name: WRITE_TOOL_NAMES.APPEND_FILE,
    type: 'function',
    function: {
      name: WRITE_TOOL_NAMES.APPEND_FILE,
      description: `
Append a chunk of content to a file.
- If the file does not exist, it will be created automatically.
- The parent directory will be created automatically if it does not exist.
- Use this tool to write a file in multiple calls when the total content is too large to fit in a single \`write-file\` call.
- Each call appends the provided content to the end of the file. After all chunks have been appended, the file is complete.
- It is recommended to keep each chunk under ~${MAX_WRITE_CONTENT_LENGTH} characters so that each tool call remains within safe limits.
      `.trim(),
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (absolute or relative)',
          },
          content: {
            type: 'string',
            description: `Content chunk to append to the file. Each chunk should be a manageable size (ideally ≤ ${MAX_WRITE_CONTENT_LENGTH} characters).`,
          },
        },
        required: ['path', 'content'],
      },
    },

    executor: async (args: any = {}) => {
      const { path: filePath, content } = args

      if (!filePath) {
        throw new ToolCallError('Path is required for appending to a file')
      }
      if (typeof content !== 'string') {
        throw new ToolCallError('Content must be a string')
      }

      try {
        const fullPath = resolveWorkspacePath(this.runtime.workspacePath, filePath)

        await fs.mkdir(path.dirname(fullPath), { recursive: true })
        await fs.appendFile(fullPath, content, 'utf8')

        const stats = await fs.stat(fullPath)

        return {
          reason: 'call-llm',
          result: {
            success: true,
            path: fullPath,
            size: stats.size,
            message: 'Chunk appended successfully',
          },
        }
      } catch (error: any) {
        console.log('append_file error', error)
        throw new ToolCallError(`Failed to append to file: ${error.message}`)
      }
    },
  })

  getTools() {
    return [this.writeFile, this.appendFile]
  }
}
