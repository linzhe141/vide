import { AlertCircle, ExternalLink, FileText, Folder, Image as ImageIcon, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import type { WorkspaceFilePreview } from './types'

type WorkspacePreviewProps = {
  preview: WorkspaceFilePreview | null
  error: string | null
}

export function WorkspacePreview({ preview, error }: WorkspacePreviewProps) {
  if (error) {
    return <PaneState title='Failed to load preview' description={error} error />
  }

  if (!preview) {
    return (
      <PaneState
        title='Select a file to preview'
        description='Text, image and video files are supported.'
      />
    )
  }

  if (preview.kind === 'folder') {
    return (
      <PaneState
        title='Folder selected'
        description={preview.path}
        icon={<Folder size={16} className='text-primary' />}
      />
    )
  }

  if (preview.kind === 'image') {
    return (
      <div className='flex h-full flex-col'>
        <PreviewHeader icon={<ImageIcon size={14} />} path={preview.path} />
        <div className='bg-foreground/3 flex h-0 flex-1 items-center justify-center p-4'>
          <img
            src={preview.fileUrl}
            alt={preview.path}
            className='max-h-full max-w-full object-contain'
          />
        </div>
      </div>
    )
  }

  if (preview.kind === 'video') {
    return (
      <div className='flex h-full flex-col'>
        <PreviewHeader icon={<Video size={14} />} path={preview.path} />
        <div className='bg-foreground/3 flex h-0 flex-1 items-center justify-center p-4'>
          <video src={preview.fileUrl} controls className='max-h-full max-w-full' />
        </div>
      </div>
    )
  }

  if (preview.kind === 'missing') {
    return (
      <div className='flex h-full flex-col'>
        <PreviewHeader icon={<AlertCircle size={14} className='text-red-500' />} path={preview.path} deleted />
        <PaneState
          title='File deleted'
          description={preview.message}
          icon={<AlertCircle size={16} className='text-red-500' />}
          error
        />
      </div>
    )
  }

  if (preview.kind === 'text') {
    return (
      <div className='flex h-full flex-col'>
        <PreviewHeader icon={<FileText size={14} />} path={preview.path} />
        {preview.truncated && (
          <div className='border-border bg-warning/8 text-warning border-b px-3 py-2 text-xs'>
            Large file detected. Only the first part is shown.
          </div>
        )}
        <pre className='h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-6 whitespace-pre-wrap'>
          {preview.content}
        </pre>
      </div>
    )
  }

  return (
    <PaneState
      title='Preview is unavailable'
      description={preview.message}
      icon={<AlertCircle size={16} className='text-warning' />}
    />
  )
}

function PreviewHeader({ icon, path, deleted }: { icon: ReactNode; path: string; deleted?: boolean }) {
  const openContainingFolder = () => {
    const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    const directoryPath = separatorIndex > 0 ? path.slice(0, separatorIndex) : path
    window.ipcRendererApi.invoke('reveal-path-in-explorer', { path: directoryPath })
  }

  return (
    <div className='border-border text-text-secondary flex items-center gap-2 border-b px-3 py-2 text-xs'>
      {icon}
      <span className={deleted ? 'truncate text-red-500 line-through' : 'truncate'}>
        {deleted && 'Deleted '}
        {path}
      </span>
      <button
        type='button'
        className='text-text-secondary hover:text-foreground ml-auto shrink-0 rounded p-1 transition'
        onClick={openContainingFolder}
        title='Open containing folder'
        aria-label='Open containing folder'
      >
        <ExternalLink size={14} />
      </button>
    </div>
  )
}

function PaneState({
  title,
  description,
  icon,
  error = false,
}: {
  title: string
  description?: string
  icon?: ReactNode
  error?: boolean
}) {
  return (
    <div className='flex h-full items-center justify-center p-6'>
      <div className='text-center'>
        <div className='mb-2 flex justify-center'>{icon ?? <FileText size={18} />}</div>
        <div
          className={
            error ? 'text-sm font-medium text-red-500' : 'text-foreground text-sm font-medium'
          }
        >
          {title}
        </div>
        {description && (
          <div className='text-text-secondary mt-1 max-w-105 text-xs'>{description}</div>
        )}
      </div>
    </div>
  )
}
