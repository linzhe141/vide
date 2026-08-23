import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceExplorerNode } from '@/store/workspaceExplorerStore'

type WorkspaceFileTreeProps = {
  root: WorkspaceExplorerNode
  selectedPath: string | null
  expandedPaths: Set<string>
  onToggle: (node: WorkspaceExplorerNode) => void
  onSelect: (node: WorkspaceExplorerNode) => void
}

export function WorkspaceFileTree(props: WorkspaceFileTreeProps) {
  return (
    <div className='px-2 pb-4'>
      <TreeNode
        node={props.root}
        level={0}
        selectedPath={props.selectedPath}
        expandedPaths={props.expandedPaths}
        onToggle={props.onToggle}
        onSelect={props.onSelect}
      />
    </div>
  )
}

type TreeNodeProps = {
  node: WorkspaceExplorerNode
  level: number
  selectedPath: string | null
  expandedPaths: Set<string>
  onToggle: (node: WorkspaceExplorerNode) => void
  onSelect: (node: WorkspaceExplorerNode) => void
}

function TreeNode({ node, level, selectedPath, expandedPaths, onToggle, onSelect }: TreeNodeProps) {
  const isFolder = node.type === 'folder'
  const isExpanded = isFolder ? expandedPaths.has(node.path) : false
  const isSelected = selectedPath === node.path
  const children = node.children ?? []

  return (
    <div>
      <button
        type='button'
        className={cn(
          'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
          'hover:bg-foreground/5',
          isSelected ? 'bg-primary/15 text-primary' : 'text-text-secondary'
        )}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            onToggle(node)
          } else onSelect(node)
        }}
      >
        {isFolder ? (
          isExpanded ? (
            <ChevronDown size={14} className='shrink-0' />
          ) : (
            <ChevronRight size={14} className='shrink-0' />
          )
        ) : (
          <span className='w-[14px] shrink-0' />
        )}

        {isFolder ? (
          isExpanded ? (
            <FolderOpen size={14} className='shrink-0' />
          ) : (
            <Folder size={14} className='shrink-0' />
          )
        ) : (
          <File size={14} className='shrink-0' />
        )}

        <span className='truncate'>{node.name}</span>
      </button>

      {isFolder && isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
