import { Eye } from 'lucide-react'
import { useChatContext } from '@/hooks/useChatContext'
import { useChatLayout } from '@/hooks/useChatLayout'
import { useSessionWorkspacePath } from '@/store/sessionStore'
import { useWorkspaceExplorerActions } from '@/store/workspaceExplorerStore'

type PreviewFileButtonProps = {
  path: string | null
  disabled?: boolean
  label?: string
}

export function PreviewFileButton({
  path,
  disabled = false,
  label = 'Preview',
}: PreviewFileButtonProps) {
  const { sessionId } = useChatContext()
  const workspacePath = useSessionWorkspacePath(sessionId)
  const { openPanel } = useChatLayout()
  const actions = useWorkspaceExplorerActions()

  const canPreview = Boolean(path && workspacePath && !disabled)

  const handleClick = () => {
    if (!canPreview || !path || !workspacePath) return
    actions.previewPath(workspacePath, path)
    openPanel('file-explorer')
  }

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={!canPreview}
      title={canPreview ? `Preview ${path}` : 'Preview is available after the tool succeeds'}
      className='border-border bg-background hover:bg-foreground/5 text-text-secondary hover:text-foreground inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50'
    >
      <Eye size={13} />
      {label}
    </button>
  )
}
