import fs from 'fs/promises'
import path from 'path'
import type { Tool } from '@/agent/core/types'

const CONFIG = {
  MAX_FILE_SIZE: 1024 * 1024, // 1MB

  // 👉 可选安全限制（默认关闭）
  ENABLE_PATH_RESTRICTION: false,
  FS_ROOT: process.cwd(),
}

/**
 * 解析路径：
 * - 支持绝对路径
 * - 相对路径默认基于 cwd
 */
function resolvePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath)
  }
  return path.resolve(process.cwd(), inputPath)
}

/**
 * 可选安全检查
 */
function assertPathAllowed(resolvedPath: string) {
  if (!CONFIG.ENABLE_PATH_RESTRICTION) return

  const root = path.resolve(CONFIG.FS_ROOT)
  if (!resolvedPath.startsWith(root)) {
    throw new Error('Access denied: path is outside allowed root')
  }
}

/**
 * 格式化大小
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 核心读取逻辑
 */
async function readFileSmart(filePath: string, encoding: BufferEncoding = 'utf8') {
  const fullPath = resolvePath(filePath)

  assertPathAllowed(fullPath)

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
    // 👉 fallback（二进制安全）
    content = finalBuffer.toString('base64')
    finalEncoding = 'base64'
  }

  return {
    path: filePath,
    resolvedPath: fullPath,
    encoding: finalEncoding,
    size: stat.size,
    sizeFormatted: formatBytes(stat.size),
    truncated,
    content,
  }
}

/**
 * Tool 定义
 */
export const fileRead: Tool = {
  name: 'read_file',
  type: 'function',
  function: {
    name: 'read_file',
    description:
      'Read file content by path. Supports absolute and relative paths. Returns up to 1MB content.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'File path (absolute or relative). Relative paths are resolved from current working directory.',
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'base64', 'hex'],
          default: 'utf8',
        },
      },
      required: ['path'],
    },
  },

  async executor(args: any = {}) {
    const { path, encoding = 'utf8' } = args

    try {
      const result = await readFileSmart(path, encoding)
      return { reason: 'call-llm', result }
    } catch (err: any) {
      throw new Error(`Read file failed: ${err.message}`)
    }
  },
}
