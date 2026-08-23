import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import chokidar, { type FSWatcher } from 'chokidar'
import { isBinaryFile } from 'isbinaryfile'
import type { WorkspaceExplorerNode, WorkspaceFilePreview } from '../../api/channels'

type WorkspaceWatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'

type WorkspaceFileChangedEvent = {
  workspacePath: string
  event: WorkspaceWatchEvent
  path: string
  target: string[]
  parentTarget: string[]
  name: string
  type: 'file' | 'folder'
}

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.ico',
  '.tiff',
  '.avif',
])

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.avi',
  '.m4v',
  '.mpeg',
  '.mpg',
  '.wmv',
])

const IGNORED_NAMES = new Set(['.git', 'node_modules'])
const DEFAULT_MAX_TEXT_BYTES = 512 * 1024
const BINARY_SAMPLE_BYTES = 8 * 1024

export class WorkspaceExplorerWatchRegistry {
  private watchers = new Map<string, { watcher: FSWatcher; refCount: number }>()

  constructor(private emitChange: (data: WorkspaceFileChangedEvent) => void) {}

  async start(workspacePath: string) {
    const rootPath = await resolveWorkspaceRoot(workspacePath)
    const current = this.watchers.get(rootPath)

    if (current) {
      current.refCount += 1
      return
    }

    const watcher = chokidar.watch(rootPath, {
      ignored: (targetPath) => shouldIgnorePath(targetPath.toString(), rootPath),
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 50,
      },
    })

    watcher.on('all', (event, changedPath) => {
      if (!isWorkspaceWatchEvent(event)) return
      const resolvedChangedPath = path.resolve(changedPath)
      if (shouldIgnorePath(resolvedChangedPath, rootPath)) return
      this.emitChange(createWatchEvent(rootPath, event, resolvedChangedPath))
    })

    this.watchers.set(rootPath, {
      watcher,
      refCount: 1,
    })
  }

  async stop(workspacePath: string) {
    const rootPath = path.resolve(workspacePath)
    const current = this.watchers.get(rootPath)
    if (!current) return

    current.refCount -= 1
    if (current.refCount > 0) return

    await current.watcher.close()
    this.watchers.delete(rootPath)
  }
}

export async function getWorkspaceFiles(data: {
  workspacePath: string
  target: string[]
}): Promise<WorkspaceExplorerNode[]> {
  const rootPath = await resolveWorkspaceRoot(data.workspacePath)
  const directoryPath = resolveTargetInsideWorkspace(rootPath, data.target)
  const stat = await fs.stat(directoryPath)
  if (!stat.isDirectory()) {
    throw new Error(`Target is not a directory: ${directoryPath}`)
  }
  return readDirectoryChildren(rootPath, directoryPath)
}

export async function getWorkspaceFileContent(data: {
  workspacePath: string
  target: string[]
  maxBytes?: number
}): Promise<WorkspaceFilePreview> {
  const rootPath = await resolveWorkspaceRoot(data.workspacePath)
  const targetPath = resolveTargetInsideWorkspace(rootPath, data.target)

  let stat
  try {
    stat = await fs.stat(targetPath)
  } catch {
    return {
      kind: 'missing',
      path: targetPath,
      message: 'The selected path no longer exists.',
    }
  }

  if (stat.isDirectory()) {
    return {
      kind: 'folder',
      path: targetPath,
    }
  }

  const ext = path.extname(targetPath).toLowerCase()
  if (IMAGE_EXTENSIONS.has(ext)) {
    return {
      kind: 'image',
      path: targetPath,
      fileUrl: pathToFileURL(targetPath).toString(),
    }
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return {
      kind: 'video',
      path: targetPath,
      fileUrl: pathToFileURL(targetPath).toString(),
    }
  }

  const maxBytes = data.maxBytes ?? DEFAULT_MAX_TEXT_BYTES
  const { content, truncated, isBinary } = await readTextFilePreviewChunk(
    targetPath,
    stat.size,
    maxBytes
  )

  if (isBinary) {
    return {
      kind: 'binary',
      path: targetPath,
      message: 'Binary file preview is not supported yet.',
    }
  }

  return {
    kind: 'text',
    path: targetPath,
    content,
    truncated,
  }
}

async function readDirectoryChildren(rootPath: string, directoryPath: string) {
  let entries: Dirent[] = []
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }

  const children: WorkspaceExplorerNode[] = []
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name) || entry.isSymbolicLink()) continue
    children.push(createNode(rootPath, path.join(directoryPath, entry.name), entry))
  }

  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return children
}

function createNode(rootPath: string, targetPath: string, entry?: Dirent): WorkspaceExplorerNode {
  const type = entry?.isDirectory() ? 'folder' : 'file'
  return {
    name: path.basename(targetPath),
    type,
    path: targetPath,
    target: getTarget(rootPath, targetPath),
  }
}

async function readTextFilePreviewChunk(targetPath: string, fileSize: number, maxBytes: number) {
  const handle = await fs.open(targetPath, 'r')

  try {
    const sampleSize = Math.min(BINARY_SAMPLE_BYTES, fileSize)
    const sampleBuffer = Buffer.alloc(Math.max(sampleSize, 1))
    const sampleRead = sampleSize
      ? (await handle.read(sampleBuffer, 0, sampleSize, 0)).bytesRead
      : 0

    const isBinary = sampleRead ? await isBinaryFile(sampleBuffer.subarray(0, sampleRead)) : false

    if (isBinary) {
      return {
        isBinary: true,
        content: '',
        truncated: false,
      }
    }

    const readSize = Math.min(fileSize, maxBytes)
    if (readSize <= 0) {
      return {
        isBinary: false,
        content: '',
        truncated: false,
      }
    }

    const contentBuffer = Buffer.alloc(readSize)
    const bytesRead = (await handle.read(contentBuffer, 0, readSize, 0)).bytesRead

    return {
      isBinary: false,
      content: contentBuffer.subarray(0, bytesRead).toString('utf8'),
      truncated: fileSize > maxBytes,
    }
  } finally {
    await handle.close()
  }
}

async function resolveWorkspaceRoot(workspacePath: string) {
  if (!workspacePath) {
    throw new Error('Workspace path is required for explorer operations.')
  }

  const resolvedPath = path.resolve(workspacePath)
  const stat = await fs.stat(resolvedPath)
  if (!stat.isDirectory()) {
    throw new Error(`Workspace path is not a directory: ${resolvedPath}`)
  }

  return resolvedPath
}

function resolveTargetInsideWorkspace(workspacePath: string, target: string[]) {
  const resolvedTarget = path.resolve(workspacePath, ...target)
  const rel = path.relative(workspacePath, resolvedTarget)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Target path is outside the active workspace.')
  }
  return resolvedTarget
}

function shouldIgnorePath(targetPath: string, rootPath: string) {
  const normalized = normalizePath(targetPath)
  const rootNormalized = normalizePath(rootPath)
  const rel = path.posix.relative(rootNormalized, normalized)
  if (rel.startsWith('..')) return true

  const segments = normalized.split('/').filter(Boolean)
  return segments.some((segment) => IGNORED_NAMES.has(segment))
}

function createWatchEvent(
  rootPath: string,
  event: WorkspaceWatchEvent,
  changedPath: string
): WorkspaceFileChangedEvent {
  const target = getTarget(rootPath, changedPath)
  return {
    workspacePath: rootPath,
    event,
    path: changedPath,
    target,
    parentTarget: target.slice(0, -1),
    name: path.basename(changedPath),
    type: event === 'addDir' || event === 'unlinkDir' ? 'folder' : 'file',
  }
}

function getTarget(rootPath: string, targetPath: string) {
  const relativePath = path.relative(rootPath, targetPath)
  if (!relativePath) return []
  return relativePath.split(path.sep).filter(Boolean)
}

function normalizePath(targetPath: string) {
  return path.resolve(targetPath).replace(/\\/g, '/')
}

function isWorkspaceWatchEvent(value: string): value is WorkspaceWatchEvent {
  return (
    value === 'add' ||
    value === 'addDir' ||
    value === 'change' ||
    value === 'unlink' ||
    value === 'unlinkDir'
  )
}
