import fs from 'fs/promises'
import path from 'path'
import type { Tool } from '@/agent/core/types'

// 写死的根目录 - 根据你的实际需求修改
const ROOT_DIR = path.resolve(process.cwd(), 'dist')

export const fsCreateFile: Tool = {
  name: 'fs_create_file',
  type: 'function',
  function: {
    name: 'fs_create_file',
    description:
      'Create, update, or append to files within the allowed directory. Supports creating new files, overwriting existing content, or appending to files. this is your root dir path',
    parameters: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description:
            'Relative file path from root directory (e.g., "notes/memo.txt", "data.json")',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
        mode: {
          type: 'string',
          enum: ['create', 'update', 'append'],
          description:
            'Operation mode: "create" (new file, fails if exists), "update" (overwrite existing or create new), "append" (add to end of file)',
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'utf-8', 'ascii', 'base64'],
          description: 'File encoding (default: utf8)',
        },
      },
      required: ['filepath', 'content', 'mode'],
    },
  },
  async executor(args: any = {}) {
    const { filepath, content, mode, encoding = 'utf8' } = args

    // 验证参数
    if (!filepath || typeof filepath !== 'string') {
      return {
        success: false,
        error: 'Invalid filepath parameter',
      }
    }

    if (content === undefined || content === null) {
      return {
        success: false,
        error: 'Content is required',
      }
    }

    if (!['create', 'update', 'append'].includes(mode)) {
      return {
        success: false,
        error: 'Invalid mode. Must be "create", "update", or "append"',
      }
    }

    try {
      // 规范化路径并确保在根目录内
      const normalizedPath = path.normalize(filepath).replace(/^(\.\.(\/|\\|$))+/, '')
      const fullPath = path.join(ROOT_DIR, normalizedPath)

      // 安全检查：确保最终路径在根目录内
      if (!fullPath.startsWith(ROOT_DIR)) {
        return {
          success: false,
          error: 'Access denied: path outside allowed directory',
        }
      }

      // 确保目录存在
      const dir = path.dirname(fullPath)
      await fs.mkdir(dir, { recursive: true })

      // 检查文件是否存在
      let fileExists = false
      try {
        await fs.access(fullPath)
        fileExists = true
      } catch {
        fileExists = false
      }

      // 根据模式执行操作
      switch (mode) {
        case 'create':
          if (fileExists) {
            return {
              success: false,
              error:
                'File already exists. Use "update" mode to overwrite or "append" to add content.',
            }
          }
          await fs.writeFile(fullPath, content, encoding)
          break

        case 'update':
          await fs.writeFile(fullPath, content, encoding)
          break

        case 'append':
          await fs.appendFile(fullPath, content, encoding)
          break
      }

      // 获取文件信息
      const stats = await fs.stat(fullPath)

      return {
        success: true,
        filepath: normalizedPath,
        fullPath,
        mode,
        size: stats.size,
        created: !fileExists && mode === 'create',
        updated: fileExists && mode === 'update',
        appended: mode === 'append',
        message: `File ${mode === 'create' ? 'created' : mode === 'update' ? 'updated' : 'appended'} successfully`,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      }
    }
  },
}
