import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type WorkspaceExplorerNode = {
  name: string
  type: 'file' | 'folder'
  path: string
  target: string[]
  children?: WorkspaceExplorerNode[]
  content?: WorkspaceFilePreview
}

export type WorkspaceFilePreview =
  | {
      kind: 'folder'
      path: string
    }
  | {
      kind: 'text'
      path: string
      content: string
      truncated: boolean
    }
  | {
      kind: 'image'
      path: string
      fileUrl: string
    }
  | {
      kind: 'video'
      path: string
      fileUrl: string
    }
  | {
      kind: 'binary'
      path: string
      message: string
    }
  | {
      kind: 'missing'
      path: string
      message: string
    }

export type WorkspaceFileChangedEvent = {
  workspacePath: string
  event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
  path: string
  target: string[]
  parentTarget: string[]
  name: string
  type: 'file' | 'folder'
}

type WorkspaceExplorerState = {
  workspacePath: string | null
  root: WorkspaceExplorerNode | null
  treeError: string | null
  previewError: string | null
  requestedPreviewPath: string | null
  expandedPaths: string[]
  selectedPath: string | null
  activePreview: {
    target: string[]
    path: string
    isDeleted: boolean
  } | null
  showFileTreePane: boolean
  watchStopper: (() => void) | null
  requestId: number
}

type WorkspaceExplorerActions = {
  actions: {
    openWorkspace: (workspacePath: string | null | undefined) => void
    closeWorkspace: () => void
    refreshRoot: () => void
    toggleFileTreePane: () => void
    toggleDirectory: (node: WorkspaceExplorerNode) => void
    selectNode: (node: WorkspaceExplorerNode) => void
    previewPath: (workspacePath: string | null | undefined, path: string) => void
  }
}

type WorkspaceExplorerStore = WorkspaceExplorerState & WorkspaceExplorerActions

const initialState: WorkspaceExplorerState = {
  workspacePath: null,
  root: null,
  treeError: null,
  previewError: null,
  requestedPreviewPath: null,
  expandedPaths: [],
  selectedPath: null,
  activePreview: null,
  showFileTreePane: true,
  watchStopper: null,
  requestId: 0,
}

export const useWorkspaceExplorerStore = create<WorkspaceExplorerStore>()(
  immer((set, get) => ({
    ...initialState,
    actions: {
      openWorkspace(workspacePath) {
        const nextWorkspacePath = workspacePath ?? null
        const currentState = get()

        if (
          nextWorkspacePath &&
          currentState.workspacePath === nextWorkspacePath &&
          currentState.root
        ) {
          if (currentState.requestedPreviewPath) {
            ensurePreviewPath(
              nextWorkspacePath,
              currentState.requestedPreviewPath,
              currentState.requestId
            )
          }
          return
        }

        stopWatching(currentState)
        const requestId = get().requestId + 1

        set((state) => {
          resetState(state)
          state.workspacePath = nextWorkspacePath
          state.requestId = requestId
          if (nextWorkspacePath) {
            state.root = createRootNode(nextWorkspacePath)
            state.expandedPaths = [nextWorkspacePath]
          }
        })

        if (!nextWorkspacePath) return
        initializeWorkspace(nextWorkspacePath, requestId, currentState.requestedPreviewPath)
        startWatching(nextWorkspacePath)
      },
      closeWorkspace() {
        stopWatching(get())
        set((state) => {
          resetState(state)
        })
      },
      refreshRoot() {
        const { workspacePath, requestedPreviewPath } = get()
        if (!workspacePath) return
        const requestId = get().requestId + 1
        set((state) => {
          state.requestId = requestId
          state.treeError = null
          state.previewError = null
          state.selectedPath = null
          state.activePreview = null
          state.root = createRootNode(workspacePath)
          state.expandedPaths = [workspacePath]
        })
        initializeWorkspace(workspacePath, requestId, requestedPreviewPath)
      },
      toggleFileTreePane() {
        set((state) => {
          state.showFileTreePane = !state.showFileTreePane
        })
      },
      toggleDirectory(node) {
        if (node.type !== 'folder') return

        const { workspacePath, requestId, root } = get()
        if (!workspacePath || !root) return
        const isExpanded = get().expandedPaths.includes(node.path)

        set((state) => {
          if (isExpanded) {
            state.expandedPaths = state.expandedPaths.filter((item) => item !== node.path)
            return
          }
          state.expandedPaths.push(node.path)
        })

        const currentNode = findNode(root, node.target)
        if (!isExpanded && currentNode?.children === undefined) {
          loadDirectory(workspacePath, node.target, requestId)
        }
      },
      selectNode(node) {
        const { workspacePath, requestId, root } = get()
        if (!workspacePath || !root) return

        set((state) => {
          state.selectedPath = node.path
          state.previewError = null
          state.activePreview = {
            target: node.target,
            path: node.path,
            isDeleted: false,
          }
          if (node.type === 'folder') {
            const targetNode = findNode(state.root, node.target)
            if (targetNode) {
              targetNode.content = {
                kind: 'folder',
                path: node.path,
              }
            }
          }
        })

        if (node.type === 'folder') return

        const cachedNode = findNode(root, node.target)
        if (cachedNode?.content) return
        loadFileContent(workspacePath, node.target, requestId)
      },
      previewPath(workspacePath, path) {
        const nextWorkspacePath = workspacePath ?? null
        if (!nextWorkspacePath || !path) return

        const currentState = get()

        if (currentState.workspacePath !== nextWorkspacePath || !currentState.root) {
          stopWatching(currentState)
          const requestId = currentState.requestId + 1

          set((state) => {
            resetState(state)
            state.workspacePath = nextWorkspacePath
            state.requestId = requestId
            state.requestedPreviewPath = path
            state.root = createRootNode(nextWorkspacePath)
            state.expandedPaths = [nextWorkspacePath]
          })

          startWatching(nextWorkspacePath)
          initializeWorkspace(nextWorkspacePath, requestId, path)
          return
        }

        set((state) => {
          state.previewError = null
          state.requestedPreviewPath = path
        })

        ensurePreviewPath(nextWorkspacePath, path, currentState.requestId)
      },
    },
  }))
)

export const useWorkspaceExplorerActions = () => useWorkspaceExplorerStore((state) => state.actions)

export const useWorkspaceExplorerPreview = () =>
  useWorkspaceExplorerStore((state) => {
    if (!state.root || !state.activePreview) return null
    const node = findNode(state.root, state.activePreview.target)
    if (state.activePreview.isDeleted) {
      return {
        kind: 'missing',
        path: state.activePreview.path,
        message: 'The selected path no longer exists.',
      } satisfies WorkspaceFilePreview
    }
    return node?.content ?? null
  })

async function loadDirectory(workspacePath: string, target: string[], requestId: number) {
  try {
    const children = await window.ipcRendererApi.invoke('get-workspace-files', {
      workspacePath,
      target,
    })

    if (!isCurrent(workspacePath, requestId)) return
    setDirectoryChildren(target, children)
  } catch (err) {
    if (!isCurrent(workspacePath, requestId)) return
    setTreeError(err)
  }
}

async function initializeWorkspace(
  workspacePath: string,
  requestId: number,
  requestedPreviewPath: string | null
) {
  await loadDirectory(workspacePath, [], requestId)

  if (!requestedPreviewPath || !isCurrent(workspacePath, requestId)) return
  await ensurePreviewPath(workspacePath, requestedPreviewPath, requestId)
}

async function ensurePreviewPath(workspacePath: string, filePath: string, requestId: number) {
  const target = getTargetFromPath(workspacePath, filePath)
  if (!target) {
    set((state) => {
      state.previewError = 'Preview path is outside the current workspace.'
    })
    return
  }

  try {
    await ensureParentDirectoriesLoaded(workspacePath, target, requestId)
    if (!isCurrent(workspacePath, requestId)) return

    const node = findNode(get().root, target)
    if (!node) {
      throw new Error('The file could not be found in the workspace tree.')
    }

    expandTargetAncestors(workspacePath, target)
    get().actions.selectNode(node)
  } catch (err) {
    if (!isCurrent(workspacePath, requestId)) return
    set((state) => {
      state.previewError = err instanceof Error ? err.message : 'Failed to open file preview'
    })
  }
}

async function ensureParentDirectoriesLoaded(
  workspacePath: string,
  target: string[],
  requestId: number
) {
  for (let depth = 0; depth < target.length; depth += 1) {
    const parentTarget = target.slice(0, depth)
    const parentNode = findNode(get().root, parentTarget)

    if (!parentNode || parentNode.type !== 'folder') {
      throw new Error('Unable to resolve the preview path in the workspace tree.')
    }

    if (parentNode.children !== undefined) continue

    const children = await window.ipcRendererApi.invoke('get-workspace-files', {
      workspacePath,
      target: parentTarget,
    })

    if (!isCurrent(workspacePath, requestId)) return
    setDirectoryChildren(parentTarget, children)
  }
}

function expandTargetAncestors(workspacePath: string, target: string[]) {
  set((state) => {
    const nextExpanded = new Set(state.expandedPaths)
    nextExpanded.add(workspacePath)

    for (let depth = 1; depth < target.length; depth += 1) {
      nextExpanded.add(joinPathSegments(workspacePath, target.slice(0, depth)))
    }

    state.expandedPaths = Array.from(nextExpanded)
  })
}

async function loadFileContent(workspacePath: string, target: string[], requestId: number) {
  try {
    const content = await window.ipcRendererApi.invoke('get-workspace-file-content', {
      workspacePath,
      target,
    })

    if (!isCurrent(workspacePath, requestId)) return
    set((state) => {
      const node = findNode(state.root, target)
      if (node) {
        node.content = content
      }
      state.previewError = null
    })
  } catch (err) {
    if (!isCurrent(workspacePath, requestId)) return
    set((state) => {
      state.previewError = err instanceof Error ? err.message : 'Failed to read file preview'
    })
  }
}

function startWatching(workspacePath: string) {
  const remove = window.ipcRendererApi.on('workspace-file-changed', (event) => {
    handleWorkspaceFileChanged(event)
  })

  set((state) => {
    state.watchStopper = remove
  })

  window.ipcRendererApi.invoke('workspace-files-watch-start', { workspacePath })
}

function stopWatching(state: WorkspaceExplorerStore) {
  state.watchStopper?.()
  if (state.workspacePath) {
    window.ipcRendererApi.invoke('workspace-files-watch-stop', {
      workspacePath: state.workspacePath,
    })
  }
}

function handleWorkspaceFileChanged(event: WorkspaceFileChangedEvent) {
  const { workspacePath, requestId, activePreview } = get()
  if (workspacePath !== event.workspacePath) return

  set((state) => {
    const parent = findNode(state.root, event.parentTarget)
    if (parent?.children) {
      if (event.event === 'unlink' || event.event === 'unlinkDir') {
        parent.children = parent.children.filter((child) => !sameTarget(child.target, event.target))
      } else {
        upsertChild(parent, createEventNode(event))
      }
    }

    if (activePreview && isDeletedByEvent(activePreview.target, event)) {
      state.activePreview = {
        ...activePreview,
        isDeleted: true,
      }
      state.previewError = null
    }
  })

  const changedNode = findNode(get().root, event.target)
  const shouldRefreshContent =
    event.event === 'change' &&
    event.type === 'file' &&
    (Boolean(changedNode?.content) ||
      Boolean(activePreview && sameTarget(activePreview.target, event.target)))

  if (shouldRefreshContent) {
    loadFileContent(workspacePath, event.target, requestId)
  }
}

function setDirectoryChildren(target: string[], children: WorkspaceExplorerNode[]) {
  set((state) => {
    const node = findNode(state.root, target)
    if (!node || node.type !== 'folder') return
    node.children = children
    state.treeError = null
  })
}

function setTreeError(err: unknown) {
  set((state) => {
    state.treeError = err instanceof Error ? err.message : 'Failed to load workspace files'
  })
}

function resetState(state: WorkspaceExplorerState) {
  state.workspacePath = null
  state.root = null
  state.treeError = null
  state.previewError = null
  state.requestedPreviewPath = null
  state.expandedPaths = []
  state.selectedPath = null
  state.activePreview = null
  state.watchStopper = null
  state.requestId += 1
}

function createRootNode(workspacePath: string): WorkspaceExplorerNode {
  return {
    name: getPathName(workspacePath),
    type: 'folder',
    path: workspacePath,
    target: [],
  }
}

function createEventNode(event: WorkspaceFileChangedEvent): WorkspaceExplorerNode {
  return {
    name: event.name,
    type: event.type,
    path: event.path,
    target: event.target,
  }
}

function upsertChild(parent: WorkspaceExplorerNode, node: WorkspaceExplorerNode) {
  const children = parent.children ?? []
  const index = children.findIndex((child) => sameTarget(child.target, node.target))
  if (index >= 0) {
    children[index] = {
      ...children[index],
      ...node,
      children: node.type === 'folder' ? children[index].children : undefined,
      content: children[index].content,
    }
  } else {
    children.push(node)
  }
  parent.children = sortNodes(children)
}

function sortNodes(nodes: WorkspaceExplorerNode[]) {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function findNode(
  node: WorkspaceExplorerNode | null,
  target: string[]
): WorkspaceExplorerNode | null {
  if (!node) return null
  if (sameTarget(node.target, target)) return node
  for (const child of node.children ?? []) {
    const found = findNode(child, target)
    if (found) return found
  }
  return null
}

function sameTarget(left: string[], right: string[]) {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function isDeletedByEvent(target: string[], event: WorkspaceFileChangedEvent) {
  if (event.event !== 'unlink' && event.event !== 'unlinkDir') return false
  return sameTarget(target, event.target)
}

function getPathName(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) ?? path
}

function getTargetFromPath(workspacePath: string, filePath: string) {
  const normalizedWorkspacePath = normalizePath(workspacePath)
  const normalizedFilePath = normalizePath(filePath)

  if (normalizedFilePath === normalizedWorkspacePath) {
    return []
  }

  if (!normalizedFilePath.startsWith(`${normalizedWorkspacePath}/`)) {
    return null
  }

  return normalizedFilePath
    .slice(normalizedWorkspacePath.length + 1)
    .split('/')
    .filter(Boolean)
}

function joinPathSegments(basePath: string, segments: string[]) {
  const separator = basePath.includes('\\') ? '\\' : '/'
  return segments.reduce((current, segment) => `${current}${separator}${segment}`, basePath)
}

function normalizePath(value: string) {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}

function isCurrent(workspacePath: string, requestId: number) {
  const state = get()
  return state.workspacePath === workspacePath && state.requestId === requestId
}

const get = useWorkspaceExplorerStore.getState
const set = useWorkspaceExplorerStore.setState
