import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import chokidar, { type FSWatcher } from 'chokidar'
import { isBinaryFile } from 'isbinaryfile'
import type { WorkspaceExplorerNode, WorkspaceFilePreview } from '../../api/channels'

type WorkspaceWatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'

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
  private watchers = new Map<
    string,
    {
      watcher: FSWatcher
      refCount: number
      tree: WorkspaceExplorerNode
      queue: Promise<void>
    }
  >()

  constructor(
    private emitChange: (data: {
      workspacePath: string
      event: WorkspaceWatchEvent
      path: string
      tree: WorkspaceExplorerNode
    }) => void
  ) {}

  async start(workspacePath: string) {
    const rootPath = await resolveWorkspaceRoot(workspacePath)
    const current = this.watchers.get(rootPath)

    if (current) {
      current.refCount += 1
      return
    }

    const tree = await readWorkspaceTree(rootPath)

    const watcher = chokidar.watch(rootPath, {
      ignored: (targetPath) => shouldIgnorePath(targetPath.toString()),
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 50,
      },
    })

    watcher.on('all', (event, changedPath) => {
      if (!isWorkspaceWatchEvent(event)) return
      const resolvedChangedPath = path.resolve(changedPath)
      const state = this.watchers.get(rootPath)
      if (!state) return

      state.queue = state.queue
        .then(async () => {
          if (event !== 'change') {
            state.tree = await syncTreeForEvent(rootPath, state.tree, event, resolvedChangedPath)
          }

          this.emitChange({
            workspacePath: rootPath,
            event,
            path: resolvedChangedPath,
            tree: state.tree,
          })
        })
        .catch(() => {
          // keep watcher queue alive
        })
    })

    this.watchers.set(rootPath, {
      watcher,
      refCount: 1,
      tree,
      queue: Promise.resolve(),
    })
  }

  async stop(workspacePath: string) {
    const rootPath = path.resolve(workspacePath)
    const current = this.watchers.get(rootPath)
    if (!current) return

    current.refCount -= 1
    if (current.refCount > 0) {
      return
    }

    await current.watcher.close()
    this.watchers.delete(rootPath)
  }

  async syncDirectory(workspacePath: string, targetPath: string) {
    const rootPath = await resolveWorkspaceRoot(workspacePath)
    const resolvedTargetPath = resolvePathInsideWorkspace(rootPath, targetPath)
    const syncDirectoryPath = await resolveSyncDirectoryPath(resolvedTargetPath)

    const state = this.watchers.get(rootPath)
    if (!state) {
      return readWorkspaceTree(rootPath)
    }

    state.tree = await syncDirectoryNode(rootPath, state.tree, syncDirectoryPath)
    return state.tree
  }
}

export async function readWorkspaceTree(workspacePath: string): Promise<WorkspaceExplorerNode> {
  const rootPath = await resolveWorkspaceRoot(workspacePath)
  const node = await buildWorkspaceTree(rootPath, rootPath)
  if (!node) {
    throw new Error(`Workspace path is not readable: ${rootPath}`)
  }
  return node
}

export async function readWorkspacePreview(data: {
  workspacePath: string
  targetPath: string
  maxBytes?: number
}): Promise<WorkspaceFilePreview> {
  const rootPath = await resolveWorkspaceRoot(data.workspacePath)
  const targetPath = resolvePathInsideWorkspace(rootPath, data.targetPath)

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

async function buildWorkspaceTree(
  rootPath: string,
  currentPath: string
): Promise<WorkspaceExplorerNode | null> {
  if (shouldIgnorePath(currentPath, rootPath)) {
    return null
  }

  let stat
  try {
    stat = await fs.lstat(currentPath)
  } catch {
    return null
  }

  if (stat.isSymbolicLink()) {
    return null
  }

  if (!stat.isDirectory()) {
    return {
      name: path.basename(currentPath),
      type: 'file',
      path: currentPath,
    }
  }

  let entries: Dirent[] = []
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true })
  } catch {
    // ignore unreadable directories
  }

  const children: WorkspaceExplorerNode[] = []
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name)) {
      continue
    }
    const childPath = path.join(currentPath, entry.name)
    const childNode = await buildWorkspaceTree(rootPath, childPath)
    if (childNode) {
      children.push(childNode)
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  return {
    name:
      currentPath === rootPath ? path.basename(rootPath) || rootPath : path.basename(currentPath),
    type: 'folder',
    path: currentPath,
    children,
  }
}

function shouldIgnorePath(targetPath: string, rootPath?: string) {
  const normalized = normalizePath(targetPath)

  if (rootPath) {
    const rootNormalized = normalizePath(rootPath)
    const rel = path.posix.relative(rootNormalized, normalized)
    if (rel.startsWith('..')) {
      return true
    }
  }

  const segments = normalized.split('/').filter(Boolean)
  return segments.some((segment) => IGNORED_NAMES.has(segment))
}

function normalizePath(targetPath: string) {
  return path.resolve(targetPath).replace(/\\/g, '/')
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

function resolvePathInsideWorkspace(workspacePath: string, targetPath: string) {
  const resolvedTarget = path.resolve(targetPath)
  const rel = path.relative(workspacePath, resolvedTarget)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Target path is outside the active workspace.')
  }
  return resolvedTarget
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

async function syncTreeForEvent(
  rootPath: string,
  currentTree: WorkspaceExplorerNode,
  event: WorkspaceWatchEvent,
  changedPath: string
) {
  if (shouldIgnorePath(changedPath, rootPath)) {
    return currentTree
  }

  if (changedPath === rootPath) {
    const rootTree = await buildWorkspaceTree(rootPath, rootPath)
    return rootTree ?? currentTree
  }

  const parentPath = path.dirname(changedPath)

  if (event === 'add' || event === 'addDir' || event === 'unlink' || event === 'unlinkDir') {
    return syncDirectoryNode(rootPath, currentTree, parentPath)
  }

  return currentTree
}

async function syncDirectoryNode(
  rootPath: string,
  currentTree: WorkspaceExplorerNode,
  directoryPath: string
): Promise<WorkspaceExplorerNode> {
  if (!isPathInsideWorkspace(rootPath, directoryPath)) {
    return currentTree
  }

  const targetNode = findNodeByPath(currentTree, directoryPath)
  if (targetNode && targetNode.type === 'folder') {
    targetNode.children = await buildDirectoryChildren(rootPath, directoryPath)
    return currentTree
  }

  let fallbackPath = directoryPath
  while (fallbackPath !== rootPath) {
    fallbackPath = path.dirname(fallbackPath)
    const fallbackNode = findNodeByPath(currentTree, fallbackPath)
    if (fallbackNode && fallbackNode.type === 'folder') {
      fallbackNode.children = await buildDirectoryChildren(rootPath, fallbackPath)
      return currentTree
    }
  }

  const rebuilt = await buildWorkspaceTree(rootPath, rootPath)
  return rebuilt ?? currentTree
}

async function buildDirectoryChildren(rootPath: string, directoryPath: string) {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }

  const children: WorkspaceExplorerNode[] = []
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name)) {
      continue
    }

    const childPath = path.join(directoryPath, entry.name)
    const childNode = await buildWorkspaceTree(rootPath, childPath)
    if (childNode) {
      children.push(childNode)
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  return children
}

function findNodeByPath(
  node: WorkspaceExplorerNode,
  targetPath: string
): WorkspaceExplorerNode | null {
  if (node.path === targetPath) {
    return node
  }

  if (!node.children?.length) {
    return null
  }

  for (const child of node.children) {
    const found = findNodeByPath(child, targetPath)
    if (found) {
      return found
    }
  }

  return null
}

function isPathInsideWorkspace(rootPath: string, targetPath: string) {
  const rel = path.relative(rootPath, targetPath)
  return !(rel.startsWith('..') || path.isAbsolute(rel))
}

async function resolveSyncDirectoryPath(targetPath: string) {
  try {
    const stat = await fs.stat(targetPath)
    return stat.isDirectory() ? targetPath : path.dirname(targetPath)
  } catch {
    return path.dirname(targetPath)
  }
}
