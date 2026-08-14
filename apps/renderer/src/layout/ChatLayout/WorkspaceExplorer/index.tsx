import { FolderTree, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatLayout } from '..'
import { WorkspaceFileTree } from './WorkspaceFileTree'
import { WorkspacePreview } from './WorkspacePreview'
import type { WorkspaceExplorerNode, WorkspaceFilePreview } from './types'

type WorkspaceExplorerPaneProps = {
  workspacePath: string | null | undefined
  className?: string
}

export function WorkspaceExplorerPane({ workspacePath, className }: WorkspaceExplorerPaneProps) {
  const { closePane } = useChatLayout()
  const [tree, setTree] = useState<WorkspaceExplorerNode | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<WorkspaceFilePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const selectedPathRef = useRef<string | null>(null)

  const workspaceName = useMemo(() => {
    if (!workspacePath) return 'No workspace selected'
    const normalized = workspacePath.replace(/\\/g, '/')
    const segments = normalized.split('/').filter(Boolean)
    return segments.at(-1) ?? workspacePath
  }, [workspacePath])

  const loadTree = useCallback(async () => {
    if (!workspacePath) {
      setTree(null)
      setTreeError(null)
      return
    }

    setTreeError(null)

    try {
      const nextTree = await window.ipcRendererApi.invoke('workspace-explorer-read-tree', {
        workspacePath,
      })
      setTree(nextTree)
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        next.add(nextTree.path)
        return next
      })

      if (selectedPath && !hasPath(nextTree, selectedPath)) {
        setSelectedPath(null)
        selectedPathRef.current = null
        setPreview(null)
      }
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : 'Failed to read workspace tree')
      setTree(null)
    }
  }, [workspacePath, selectedPath])

  const loadPreview = useCallback(
    async (targetPath: string) => {
      if (!workspacePath) return
      setPreviewError(null)
      try {
        const data = await window.ipcRendererApi.invoke('workspace-explorer-read-file', {
          workspacePath,
          targetPath,
        })
        setPreview(data)
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : 'Failed to read file preview')
        setPreview(null)
      }
    },
    [workspacePath]
  )

  const syncDirectory = useCallback(
    async (targetPath: string) => {
      if (!workspacePath) return
      const nextTree = await window.ipcRendererApi.invoke('workspace-explorer-sync-directory', {
        workspacePath,
        targetPath,
      })
      setTree(nextTree)
    },
    [workspacePath]
  )

  useEffect(() => {
    selectedPathRef.current = selectedPath
  }, [selectedPath])

  useEffect(() => {
    if (!workspacePath) {
      const resetTimer = window.setTimeout(() => {
        setTree(null)
        setTreeError(null)
        setPreview(null)
        setPreviewError(null)
        setSelectedPath(null)
        selectedPathRef.current = null
      }, 0)
      return () => {
        window.clearTimeout(resetTimer)
      }
    }

    const initialLoadTimer = window.setTimeout(() => {
      loadTree()
    }, 0)

    const remove = window.ipcRendererApi.on('workspace-explorer-changed', (event) => {
      if (event.workspacePath !== workspacePath) return
      setTree(event.tree)

      const currentSelectedPath = selectedPathRef.current
      if (!currentSelectedPath) {
        return
      }

      if (!hasPath(event.tree, currentSelectedPath)) {
        setSelectedPath(null)
        selectedPathRef.current = null
        setPreview(null)
        setPreviewError(null)
        return
      }

      if (event.path === currentSelectedPath) {
        loadPreview(currentSelectedPath)
      }
    })

    window.ipcRendererApi.invoke('workspace-explorer-watch-start', {
      workspacePath,
    })

    return () => {
      window.clearTimeout(initialLoadTimer)
      remove()
      window.ipcRendererApi.invoke('workspace-explorer-watch-stop', {
        workspacePath,
      })
    }
  }, [workspacePath, loadPreview, loadTree])

  return (
    <div className={cn('bg-background flex h-full flex-col', className)}>
      <div className='border-border flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-primary/8 text-primary border-primary/10 rounded-lg border p-1.5'>
          <FolderTree size={15} strokeWidth={1.9} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-foreground truncate text-sm font-medium'>{workspaceName}</div>
          {workspacePath && (
            <div className='text-text-secondary truncate text-xs'>{workspacePath}</div>
          )}
        </div>
        <button
          type='button'
          className='text-text-secondary hover:text-foreground rounded p-1 transition'
          onClick={() => {
            if (!workspacePath) return
            syncDirectory(workspacePath)
          }}
          title='Refresh workspace tree'
        >
          <RefreshCw size={15} />
        </button>
        <button
          type='button'
          className='text-text-secondary hover:text-foreground rounded p-1 transition'
          onClick={() => closePane?.()}
          title='Close pane'
        >
          <X size={16} />
        </button>
      </div>

      {!workspacePath ? (
        <div className='text-text-secondary p-4 text-sm'>This session has no workspace path.</div>
      ) : (
        <div className='flex h-0 flex-1'>
          <div className='border-border h-full w-[500px] overflow-auto border-r'>
            {treeError && !tree && <div className='p-3 text-sm text-red-500'>{treeError}</div>}
            {tree && (
              <WorkspaceFileTree
                root={tree}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onToggle={(targetPath) => {
                  let shouldSync = false
                  setExpandedPaths((prev) => {
                    const next = new Set(prev)
                    if (next.has(targetPath)) {
                      next.delete(targetPath)
                    } else {
                      next.add(targetPath)
                      shouldSync = true
                    }
                    return next
                  })

                  if (shouldSync) {
                    syncDirectory(targetPath)
                  }
                }}
                onSelect={(node) => {
                  setSelectedPath(node.path)
                  selectedPathRef.current = node.path
                  if (node.type === 'folder') {
                    setPreview({
                      kind: 'folder',
                      path: node.path,
                    })
                    setPreviewError(null)
                    syncDirectory(node.path)
                    return
                  }
                  loadPreview(node.path)
                }}
              />
            )}
          </div>

          <div className='h-full flex-1 overflow-hidden'>
            <WorkspacePreview preview={preview} error={previewError} />
          </div>
        </div>
      )}
    </div>
  )
}

function hasPath(root: WorkspaceExplorerNode, targetPath: string): boolean {
  if (root.path === targetPath) return true
  if (!root.children?.length) return false
  return root.children.some((child) => hasPath(child, targetPath))
}
