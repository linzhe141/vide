import { FolderOpen, RefreshCw, X } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  useWorkspaceExplorerActions,
  useWorkspaceExplorerPreview,
  useWorkspaceExplorerStore,
} from '@/store/workspaceExplorerStore'
import { useChatLayout } from '@/hooks/useChatLayout'
import { WorkspaceFileTree } from './WorkspaceFileTree'
import { WorkspacePreview } from './WorkspacePreview'

type WorkspaceExplorerPaneProps = {
  workspacePath: string | null | undefined
  className?: string
}

export function WorkspaceExplorerPane({ workspacePath, className }: WorkspaceExplorerPaneProps) {
  const { closePane } = useChatLayout()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const root = useWorkspaceExplorerStore((state) => state.root)
  const treeError = useWorkspaceExplorerStore((state) => state.treeError)
  const selectedPath = useWorkspaceExplorerStore((state) => state.selectedPath)
  const preview = useWorkspaceExplorerPreview()
  const previewError = useWorkspaceExplorerStore((state) => state.previewError)
  const expandedPathList = useWorkspaceExplorerStore((state) => state.expandedPaths)
  const actions = useWorkspaceExplorerActions()
  const [isCompact, setIsCompact] = useState(false)
  const [compactView, setCompactView] = useState<'tree' | 'preview'>('tree')

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

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const nextIsCompact = entry.contentRect.width < 820
      setIsCompact(nextIsCompact)
      if (nextIsCompact && selectedPath) {
        setCompactView('preview')
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [selectedPath])

  const treePane = (
    <div className='mt-2 flex min-w-0 flex-col overflow-hidden'>
      {treeError && !root && <div className='p-3 text-sm text-red-500'>{treeError}</div>}
      <div className='h-0 flex-1 overflow-auto'>
        {root ? (
          <WorkspaceFileTree
            root={root}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onToggle={actions.toggleDirectory}
            onSelect={(node) => {
              actions.selectNode(node)
              if (isCompact) {
                setCompactView('preview')
              }
            }}
          />
        ) : null}
      </div>
    </div>
  )

  const previewPane = <WorkspacePreview preview={preview} error={previewError} />

  return (
    <div ref={containerRef} className={cn('bg-background flex h-full flex-col', className)}>
      <div className='border-border flex items-center gap-3 border-b px-4 py-3'>
        <button
          type='button'
          className='bg-primary/8 text-primary border-primary/10 rounded-lg border p-1.5'
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
      ) : isCompact ? (
        <div className='flex h-0 flex-1 flex-col'>
          <div className='border-border text-text-secondary flex items-center justify-between border-b px-4 py-2 text-xs'>
            <span>{compactView === 'tree' ? 'Workspace files' : 'Preview'}</span>
            <div className='border-border bg-background flex overflow-hidden rounded-full border'>
              <button
                type='button'
                className={cn(
                  'px-3 py-1.5 transition',
                  compactView === 'tree' ? 'bg-primary/10 text-primary' : 'hover:text-foreground'
                )}
                onClick={() => setCompactView('tree')}
              >
                Files
              </button>
              <button
                type='button'
                className={cn(
                  'px-3 py-1.5 transition',
                  compactView === 'preview' ? 'bg-primary/10 text-primary' : 'hover:text-foreground'
                )}
                onClick={() => setCompactView('preview')}
              >
                Preview
              </button>
            </div>
          </div>

          <div className='h-0 flex-1 overflow-hidden'>
            {compactView === 'tree' ? treePane : previewPane}
          </div>
        </div>
      ) : (
        <Group className='h-0 flex-1'>
          <Panel>{previewPane}</Panel>
          <Separator className='group relative cursor-col-resize bg-transparent'></Separator>

          <Panel minSize={240} maxSize={540} defaultSize={240} className='border-border border-l'>
            {treePane}
          </Panel>
        </Group>
      )}
    </div>
  )
}
