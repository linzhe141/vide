import { useEffect, useRef, useState } from 'react'
import { Folder, FileText, ChevronRight, ChevronDown } from 'lucide-react'
import type { FileNode } from '@/electron/ipc/api/channels'
import { CodeBlock } from '../../components/codeblock'
import { cn } from '../../lib/utils'

export function ArtifactsDisplay({
  threadId,
  className,
}: {
  threadId: string
  className?: string
}) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [artifacts, setArtifacts] = useState<
    {
      id: string
      threadId: string
      artifactWorkspaceName: string
      createdAt: number
      file: FileNode
      updatedAt: number
    }[]
  >([])

  const timer = useRef<number | null>(null)
  useEffect(() => {
    async function fetchArtifacts() {
      const res = await window.ipcRendererApi.invoke('get-thread-artifacts', {
        sessionId: threadId,
      })
      setArtifacts(res)
    }
    fetchArtifacts()

    timer.current = window.setInterval(fetchArtifacts, 250)

    return () => {
      window.clearInterval(timer.current!)
    }
  }, [threadId])
  return (
    <div className={cn('flex h-full', className)}>
      {/* Sidebar */}
      <div className='border-border bg-background flex h-full w-64 flex-col border-r'>
        <div className='text-text-secondary sticky p-3 text-sm'>Artifacts</div>

        <div className='h-0 flex-1 overflow-auto px-2'>
          {artifacts.map((i) => (
            <TreeNode key={i.artifactWorkspaceName} node={i.file} onSelect={setSelectedFile} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className='bg-background w-0 flex-1'>
        <div className='flex h-full flex-col'>
          {/* header */}
          <div className='border-border text-text-secondary border-b px-4 py-2 text-sm'>
            {selectedFile?.name || 'No file selected'}
          </div>

          {/* content */}
          <div className='flex-1 overflow-auto p-4 font-mono text-sm'>
            {selectedFile ? (
              selectedFile.content ? (
                <CodeBlock
                  code={selectedFile.content ?? ''}
                  lang={selectedFile.name.split('.').at(-1) ?? 'tsx'}
                ></CodeBlock>
              ) : (
                <div className='text-text-info'>this is a binary file</div>
              )
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
  const [open, setOpen] = useState(false)

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
        <span className='flex-1 overflow-hidden text-xs font-thin overflow-ellipsis whitespace-nowrap'>
          {node.name}
        </span>
      </div>

      {/* children */}
      {isFolder && open && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.name} node={child} level={level + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}
