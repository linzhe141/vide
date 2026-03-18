import { useState } from 'react'
import { Folder, FileText, ChevronRight, ChevronDown } from 'lucide-react'

type FileNode = {
  id: string
  name: string
  type: 'file' | 'folder'
  content?: string
  children?: FileNode[]
}

const mockTree: FileNode[] = [
  {
    id: '1',
    name: 'src',
    type: 'folder',
    children: [
      {
        id: '1-1',
        name: 'components',
        type: 'folder',
        children: [
          {
            id: '1-1-1',
            name: 'Button.tsx',
            type: 'file',
            content: `export const Button = () => <button>Click</button>`,
          },
        ],
      },
      {
        id: '1-2',
        name: 'App.tsx',
        type: 'file',
        content: `export default function App() { return <div>Hello</div> }`,
      },
    ],
  },
  {
    id: '2',
    name: 'package.json',
    type: 'file',
    content: `{ "name": "demo" }`,
  },
]

export function ArtifactsDisplay() {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)

  return (
    <div className='flex h-full'>
      {/* Sidebar */}
      <div className='border-border bg-background w-64 border-r'>
        <div className='text-text-secondary p-3 text-sm'>Artifacts</div>

        <div className='px-2'>
          {mockTree.map((node) => (
            <TreeNode key={node.id} node={node} onSelect={setSelectedFile} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className='bg-background flex-1'>
        <div className='flex h-full flex-col'>
          {/* header */}
          <div className='border-border text-text-secondary border-b px-4 py-2 text-sm'>
            {selectedFile?.name || 'No file selected'}
          </div>

          {/* content */}
          <div className='flex-1 overflow-auto p-4 font-mono text-sm'>
            {selectedFile ? (
              <pre className='whitespace-pre-wrap'>{selectedFile.content}</pre>
            ) : (
              <div className='text-text-info'>Select a file to preview</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Tree ---------------- */

function TreeNode({
  node,
  level = 0,
  onSelect,
}: {
  node: FileNode
  level?: number
  onSelect: (file: FileNode) => void
}) {
  const [open, setOpen] = useState(true)

  const isFolder = node.type === 'folder'

  return (
    <div>
      <div
        className='group hover:bg-border/40 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition'
        style={{ paddingLeft: 8 + level * 12 }}
        onClick={() => {
          if (!isFolder) onSelect(node)
          else {
            setOpen(!open)
          }
        }}
      >
        {/* expand icon */}
        {isFolder ? (
          <span className='text-text-secondary'>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className='w-[14px]' />
        )}

        {/* file/folder icon */}
        {isFolder ? <Folder size={14} /> : <FileText size={14} />}

        {/* name */}
        <span className='flex-1 text-xs font-thin'>{node.name}</span>
      </div>

      {/* children */}
      {isFolder && open && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}
