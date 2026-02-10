import fs from 'fs/promises'
import path from 'path'
import type { Tool } from '@/agent/core/types'

/**
 * Root directory sandbox.
 * All filesystem operations are restricted to this directory.
 */
const FS_ROOT = process.cwd()

/**
 * Configuration for filtering and limits
 */
const CONFIG = {
  // 最大递归深度
  MAX_RECURSION_DEPTH: 3,

  // 单个文件最大读取大小（1MB）
  MAX_FILE_SIZE: 1024 * 1024,

  // 列表操作返回的最大条目数
  MAX_LIST_ENTRIES: 500,

  // 需要忽略的目录和文件
  IGNORE_PATTERNS: ['node_modules', '.git', '.DS_Store'],

  // 需要忽略的文件扩展名
  IGNORE_EXTENSIONS: [
    '.pyc',
    '.pyo',
    '.so',
    '.dylib',
    '.dll',
    '.exe',
    '.bin',
    '.lock',
    '.ico',
    '.ttf',
    '.woff',
    '.woff2',
    '.eot',
    '.pdf',
    '.zip',
    '.tar',
    '.gz',
    '.rar',
    '.7z',
    '.mp4',
    '.avi',
    '.mov',
    '.mp3',
    '.wav',
  ],
}

/**
 * Check if a path should be ignored based on patterns.
 */
function shouldIgnore(name: string, isDirectory: boolean): boolean {
  // 检查是否匹配忽略模式
  for (const pattern of CONFIG.IGNORE_PATTERNS) {
    if (pattern.includes('*')) {
      // 处理通配符模式
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      if (regex.test(name)) {
        return true
      }
    } else if (name === pattern) {
      return true
    }
  }

  // 检查文件扩展名
  if (!isDirectory) {
    const ext = path.extname(name).toLowerCase()
    if (CONFIG.IGNORE_EXTENSIONS.includes(ext)) {
      return true
    }
  }

  // 忽略隐藏文件（以.开头的，除了一些常见的配置文件）
  if (name.startsWith('.') && !isAllowedHiddenFile(name)) {
    return true
  }

  return false
}

/**
 * 允许的隐藏文件列表（常见配置文件）
 */
function isAllowedHiddenFile(name: string): boolean {
  const allowed = [
    '.gitignore',
    '.env.example',
    '.env.template',
    '.eslintrc',
    '.prettierrc',
    '.babelrc',
    '.editorconfig',
    '.npmrc',
    '.nvmrc',
    '.dockerignore',
  ]

  return allowed.some((pattern) => name === pattern || name.startsWith(pattern + '.'))
}

/**
 * Resolve path safely and prevent path traversal.
 */
function resolveSafePath(inputPath: string): string {
  const resolvedPath = path.resolve(FS_ROOT, inputPath)
  if (!resolvedPath.startsWith(FS_ROOT)) {
    throw new Error('Access denied: path is outside of root directory')
  }
  return resolvedPath
}

/**
 * List directory contents (optionally recursive with depth limit).
 */
async function listDirectory(dirPath: string, recursive = false, currentDepth = 0) {
  const fullPath = resolveSafePath(dirPath)
  const entries = await fs.readdir(fullPath, { withFileTypes: true })

  const result: Array<{
    type: 'file' | 'directory'
    name: string
    path: string
    depth?: number
  }> = []

  let entryCount = 0

  for (const entry of entries) {
    // 检查是否超出条目限制
    if (entryCount >= CONFIG.MAX_LIST_ENTRIES) {
      result.push({
        type: 'file',
        name: '[WARNING]',
        path: '[TRUNCATED]',
        depth: currentDepth,
      } as any)
      break
    }

    // 过滤不需要的文件和目录
    if (shouldIgnore(entry.name, entry.isDirectory())) {
      continue
    }

    const entryFullPath = path.join(fullPath, entry.name)
    const relativePath = path.relative(FS_ROOT, entryFullPath)

    if (entry.isDirectory()) {
      result.push({
        type: 'directory',
        name: entry.name,
        path: relativePath,
        depth: currentDepth,
      })
      entryCount++

      // 递归列出子目录，但要检查深度限制
      if (recursive && currentDepth < CONFIG.MAX_RECURSION_DEPTH) {
        try {
          const children = await listDirectory(relativePath, true, currentDepth + 1)
          result.push(...children)
          entryCount += children.length
        } catch (_error) {
          // 忽略无法访问的子目录
          console.warn(`Cannot access directory: ${relativePath}`)
        }
      }
    } else {
      result.push({
        type: 'file',
        name: entry.name,
        path: relativePath,
        depth: currentDepth,
      })
      entryCount++
    }
  }

  return result
}

/**
 * Read file content (read-only) with size limit.
 */
async function readFile(filePath: string, encoding: BufferEncoding = 'utf8') {
  const fullPath = resolveSafePath(filePath)
  const stat = await fs.stat(fullPath)

  if (!stat.isFile()) {
    throw new Error('Target is not a file')
  }

  // 检查文件大小限制
  if (stat.size > CONFIG.MAX_FILE_SIZE) {
    return {
      path: filePath,
      encoding,
      size: stat.size,
      content: `[FILE TOO LARGE: ${formatBytes(stat.size)}. Maximum allowed: ${formatBytes(CONFIG.MAX_FILE_SIZE)}]`,
      truncated: true,
    }
  }

  const content = await fs.readFile(fullPath, { encoding })

  return {
    path: filePath,
    encoding,
    size: stat.size,
    content,
    truncated: false,
  }
}

/**
 * Format bytes to human-readable format.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get basic file or directory info.
 */
async function getFileInfo(filePath: string) {
  const fullPath = resolveSafePath(filePath)
  const stat = await fs.stat(fullPath)

  return {
    path: filePath,
    type: stat.isDirectory() ? 'directory' : 'file',
    size: stat.size,
    sizeFormatted: formatBytes(stat.size),
    createdAt: stat.birthtime,
    updatedAt: stat.mtime,
    readable: stat.size <= CONFIG.MAX_FILE_SIZE,
  }
}

/**
 * Check whether a path exists.
 */
async function checkExists(filePath: string) {
  try {
    const fullPath = resolveSafePath(filePath)
    await fs.access(fullPath)
    return true
  } catch {
    return false
  }
}

/**
 * Get detailed fs stats.
 */
async function getFileStats(filePath: string) {
  const fullPath = resolveSafePath(filePath)
  const stat = await fs.stat(fullPath)

  return {
    path: filePath,
    isFile: stat.isFile(),
    isDirectory: stat.isDirectory(),
    size: stat.size,
    sizeFormatted: formatBytes(stat.size),
    mode: stat.mode,
    uid: stat.uid,
    gid: stat.gid,
    atime: stat.atime,
    mtime: stat.mtime,
    ctime: stat.ctime,
    birthtime: stat.birthtime,
    readable: stat.isFile() ? stat.size <= CONFIG.MAX_FILE_SIZE : true,
  }
}

/**
 * Read-only filesystem tool definition.
 */
export const fileSystem: Tool = {
  name: 'file_system',
  type: 'function',
  function: {
    name: 'file_system',
    description:
      'Read-only filesystem access with smart filtering. Supports listing directories (excludes node_modules, .git, etc.), reading files (max 1MB), and retrieving file metadata. Automatically filters common build artifacts and binary files to prevent context overflow.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['list', 'read', 'info', 'exists', 'stats'],
          description: 'Filesystem operation to perform',
        },
        path: {
          type: 'string',
          description: 'File or directory path (relative to root)',
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'base64', 'hex'],
          description: 'File encoding when reading content',
          default: 'utf8',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list directories recursively (max depth: 3)',
          default: false,
        },
      },
      required: ['operation', 'path'],
    },
  },

  async executor(args: any = {}) {
    const { operation, path: filePath, encoding = 'utf8', recursive = false } = args

    try {
      switch (operation) {
        case 'list':
          return await listDirectory(filePath, recursive)

        case 'read':
          return await readFile(filePath, encoding)

        case 'info':
          return await getFileInfo(filePath)

        case 'exists':
          return await checkExists(filePath)

        case 'stats':
          return await getFileStats(filePath)

        default:
          throw new Error(`Unsupported operation: ${operation}`)
      }
    } catch (error: any) {
      throw new Error(`File system operation failed: ${error.message}`)
    }
  },
}

/**
 * Export configuration for external use/testing
 */
export { CONFIG }
