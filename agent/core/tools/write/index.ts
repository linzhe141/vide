import fs from 'fs/promises'
import path from 'path'
import type { WorkflowRuntimeContext } from '../../workflowRuntimeContext'
import { defineTool, ToolProvider } from '../toolProvider'

export const WRITE_NAMESPACE = 'BUILDIN_WRITE_NAMESPACE'
export const WRITE_TOOL_NAMES = {
  WRITE_FILE: `${WRITE_NAMESPACE}_WRITE_FILE`,
} as const

export class Write extends ToolProvider {
  constructor(runtime: WorkflowRuntimeContext) {
    super(runtime)
  }

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
        console.log('write_file error', error)
        return {
          reason: 'call-llm',
          result: {
            success: false,
            error: error.message,
          },
        }
      }
    },
  })

  getTools() {
    return [this.writeFile]
  }
}
