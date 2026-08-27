import { ExternalLink, Image as ImageIcon, X } from 'lucide-react'
import { useState } from 'react'
import { useChatLayout } from '@/hooks/useChatLayout'
import { getContainingDirectoryPath } from '@/lib/localAsset'
import { useSelectedImagePreview } from '@/store/imagePreviewStore'

export function ImagePreviewPane() {
  const preview = useSelectedImagePreview()
  const { closePane } = useChatLayout()

  const openContainingFolder = () => {
    if (!preview) return

    window.ipcRendererApi.invoke('reveal-path-in-explorer', {
      path: getContainingDirectoryPath(preview.path),
    })
  }

  return (
    <div className='bg-background flex h-full flex-col'>
      <div className='border-border flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-primary/8 text-primary border-primary/10 rounded-lg border p-1.5'>
          <ImageIcon size={15} strokeWidth={1.9} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-foreground truncate text-sm font-medium'>
            {preview?.name ?? 'Image preview'}
          </div>
          <div className='text-text-secondary truncate text-xs'>
            {preview?.path ?? 'Click an image result to preview it here.'}
          </div>
        </div>
        {preview && (
          <button
            type='button'
            className='text-text-secondary hover:text-foreground rounded p-1 transition'
            onClick={openContainingFolder}
            title='Open folder'
            aria-label='Open folder'
          >
            <ExternalLink size={15} />
          </button>
        )}
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

      {!preview ? (
        <div className='flex h-0 flex-1 items-center justify-center p-6'>
          <div className='text-center'>
            <div className='mb-2 flex justify-center'>
              <ImageIcon size={18} className='text-primary' />
            </div>
            <div className='text-foreground text-sm font-medium'>No image selected</div>
            <div className='text-text-secondary mt-1 max-w-105 text-xs'>
              Click an image tool result in chat to open it in this panel.
            </div>
          </div>
        </div>
      ) : (
        <PreviewImage key={preview.fileUrl} fileUrl={preview.fileUrl} name={preview.name} />
      )}
    </div>
  )
}

function PreviewImage({ fileUrl, name }: { fileUrl: string; name: string }) {
  const [loadFailed, setLoadFailed] = useState(false)

  if (loadFailed) {
    return (
      <div className='flex h-0 flex-1 items-center justify-center p-6'>
        <div className='text-center'>
          <div className='text-foreground text-sm font-medium'>Preview is unavailable</div>
          <div className='text-text-secondary mt-1 max-w-105 text-xs'>
            The local image file could not be loaded. You can still open its folder.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='bg-foreground/3 flex h-0 flex-1 items-center justify-center p-4'>
      <img
        src={fileUrl}
        alt={name}
        className='max-h-full max-w-full object-contain'
        onError={() => setLoadFailed(true)}
      />
    </div>
  )
}
