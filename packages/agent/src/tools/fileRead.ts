import fs from 'fs/promises'
import path from 'path'
import type { Tool } from '@vide/ai'
import { ToolCallError } from '../error'

const CONFIG = {
  MAX_FILE_SIZE: 1024 * 1024, // 1MB

  // 馃憠 鍙€夊畨鍏ㄩ檺鍒讹紙榛樿鍏抽棴锛?
  ENABLE_PATH_RESTRICTION: false,
  FS_ROOT: process.cwd(),
}

/**
 * 瑙ｆ瀽璺緞锛?
 * - 鏀寔缁濆璺緞
 * - 鐩稿璺緞榛樿鍩轰簬 cwd
 */
function resolvePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath)
  }
  return path.resolve(process.cwd(), inputPath)
}

/**
 * 鍙€夊畨鍏ㄦ鏌?
 */
function assertPathAllowed(resolvedPath: string) {
  if (!CONFIG.ENABLE_PATH_RESTRICTION) return

  const root = path.resolve(CONFIG.FS_ROOT)
  if (!resolvedPath.startsWith(root)) {
    throw new Error('Access denied: path is outside allowed root')
  }
}

/**
 * 鏍煎紡鍖栧ぇ灏?
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 鏍稿績璇诲彇閫昏緫
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
    // 馃憠 fallback锛堜簩杩涘埗瀹夊叏锛?
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
 * Tool 瀹氫箟
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
      throw new ToolCallError(
        `Read file failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  },
}
