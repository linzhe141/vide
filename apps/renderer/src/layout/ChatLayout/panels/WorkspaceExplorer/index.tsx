import { FolderOpen, RefreshCw, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  useWorkspaceExplorerActions,
  useWorkspaceExplorerPreview,
  useWorkspaceExplorerStore,
} from '@/store/workspaceExplorerStore'
import { useChatLayout } from '../..'
import { WorkspaceFileTree } from './WorkspaceFileTree'
import { WorkspacePreview } from './WorkspacePreview'

type WorkspaceExplorerPaneProps = {
  workspacePath: string | null | undefined
  className?: string
}

export function WorkspaceExplorerPane({ workspacePath, className }: WorkspaceExplorerPaneProps) {
  const { closePane } = useChatLayout()
  const root = useWorkspaceExplorerStore((state) => state.root)
  const treeError = useWorkspaceExplorerStore((state) => state.treeError)
  const selectedPath = useWorkspaceExplorerStore((state) => state.selectedPath)
  const preview = useWorkspaceExplorerPreview()
  const previewError = useWorkspaceExplorerStore((state) => state.previewError)
  const expandedPathList = useWorkspaceExplorerStore((state) => state.expandedPaths)
  const showFileTreePane = useWorkspaceExplorerStore((state) => state.showFileTreePane)
  const actions = useWorkspaceExplorerActions()

  const workspaceName = useMemo(() => {
    if (!workspacePath) return 'No workspace selected'
    const normalized = workspacePath.replace(/\\/g, '/')
    const segments = normalized.split('/').filter(Boolean)
    return segments.at(-1) ?? workspacePath
  }, [workspacePath])
  const expandedPaths = useMemo(() => new Set(expandedPathList), [expandedPathList])

  useEffect(() => {
    actions.openWorkspace(workspacePath)
    return () => {
      actions.closeWorkspace()
    }
  }, [actions, workspacePath])

  return (
    <div className={cn('bg-background flex h-full flex-col', className)}>
      <div className='border-border flex items-center gap-3 border-b px-4 py-3'>
        <button
          type='button'
          className='bg-primary/8 text-primary border-primary/10 rounded-lg border p-1.5'
          onClick={actions.toggleFileTreePane}
          title='Toggle file tree'
          aria-label='Toggle file tree'
        >
          <FolderOpen size={15} strokeWidth={1.9} />
        </button>
        <div className='min-w-0 flex-1'>
          <div className='text-foreground truncate text-sm font-medium'>{workspaceName}</div>
          {workspacePath && (
            <div className='text-text-secondary truncate text-xs'>{workspacePath}</div>
          )}
        </div>
        <button
          type='button'
          className='text-text-secondary hover:text-foreground rounded p-1 transition'
          onClick={actions.refreshRoot}
          title='Refresh workspace tree'
          aria-label='Refresh workspace tree'
        >
          <RefreshCw size={15} />
        </button>
        <button
          type='button'
          className='text-text-secondary hover:text-foreground rounded p-1 transition'
          onClick={closePane}
          title='Close pane'
          aria-label='Close pane'
        >
          <X size={16} />
        </button>
      </div>

      {!workspacePath ? (
        <div className='text-text-secondary p-4 text-sm'>This session has no workspace path.</div>
      ) : (
        <div className='flex h-0 flex-1'>
          {showFileTreePane && (
            <div className='border-border h-full w-125 overflow-auto border-r'>
              {treeError && !root && <div className='p-3 text-sm text-red-500'>{treeError}</div>}
              {root && (
                <WorkspaceFileTree
                  root={root}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  onToggle={actions.toggleDirectory}
                  onSelect={actions.selectNode}
                />
              )}
            </div>
          )}

          <div className='h-full flex-1 overflow-hidden'>
            <WorkspacePreview preview={preview} error={previewError} />
          </div>
        </div>
      )}
    </div>
  )
}