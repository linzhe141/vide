import fs from 'fs/promises'
import path from 'path'
import type { Tool } from '@/agent/core/types'

/**
 * Root directory sandbox.
 * All filesystem operations are restricted to this directory.
 */
const FS_ROOT = process.cwd()

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
 * List directory contents (optionally recursive).
 */
async function listDirectory(dirPath: string, recursive = false) {
  const fullPath = resolveSafePath(dirPath)
  const entries = await fs.readdir(fullPath, { withFileTypes: true })

  const result: Array<{
    type: 'file' | 'directory'
    name: string
    path: string
  }> = []

  for (const entry of entries) {
    const entryFullPath = path.join(fullPath, entry.name)
    const relativePath = path.relative(FS_ROOT, entryFullPath)

    if (entry.isDirectory()) {
      result.push({
        type: 'directory',
        name: entry.name,
        path: relativePath,
      })

      if (recursive) {
        const children = await listDirectory(relativePath, true)
        result.push(...children)
      }
    } else {
      result.push({
        type: 'file',
        name: entry.name,
        path: relativePath,
      })
    }
  }

  return result
}

/**
 * Read file content (read-only).
 */
async function readFile(filePath: string, encoding: BufferEncoding = 'utf8') {
  const fullPath = resolveSafePath(filePath)
  const stat = await fs.stat(fullPath)

  if (!stat.isFile()) {
    throw new Error('Target is not a file')
  }

  const content = await fs.readFile(fullPath, { encoding })

  return {
    path: filePath,
    encoding,
    size: stat.size,
    content,
  }
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
    createdAt: stat.birthtime,
    updatedAt: stat.mtime,
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
    mode: stat.mode,
    uid: stat.uid,
    gid: stat.gid,
    atime: stat.atime,
    mtime: stat.mtime,
    ctime: stat.ctime,
    birthtime: stat.birthtime,
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
      'Read-only filesystem access. Supports listing directories, reading files, and retrieving file metadata.',
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
          description: 'Whether to list directories recursively',
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
