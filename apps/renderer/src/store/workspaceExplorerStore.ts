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
  }
}

type WorkspaceExplorerStore = WorkspaceExplorerState & WorkspaceExplorerActions

const initialState: WorkspaceExplorerState = {
  workspacePath: null,
  root: null,
  treeError: null,
  previewError: null,
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
        stopWatching(get())
        const nextWorkspacePath = workspacePath ?? null
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
        void loadDirectory(nextWorkspacePath, [], requestId)
        startWatching(nextWorkspacePath)
      },
      closeWorkspace() {
        stopWatching(get())
        set((state) => {
          resetState(state)
        })
      },
      refreshRoot() {
        const { workspacePath } = get()
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
        void loadDirectory(workspacePath, [], requestId)
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
          void loadDirectory(workspacePath, node.target, requestId)
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
        void loadFileContent(workspacePath, node.target, requestId)
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

  void window.ipcRendererApi.invoke('workspace-files-watch-start', { workspacePath })
}

function stopWatching(state: WorkspaceExplorerStore) {
  state.watchStopper?.()
  if (state.workspacePath) {
    void window.ipcRendererApi.invoke('workspace-files-watch-stop', {
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
    void loadFileContent(workspacePath, event.target, requestId)
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

function isCurrent(workspacePath: string, requestId: number) {
  const state = get()
  return state.workspacePath === workspacePath && state.requestId === requestId
}

const get = useWorkspaceExplorerStore.getState
const set = useWorkspaceExplorerStore.setState
