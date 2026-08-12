import { Aperture, FolderOpen, LoaderCircle, Send, X, Zap } from 'lucide-react'
import { useState, useRef, useEffect, memo } from 'react'
import { Textarea } from '../../../ui/Textarea'
import { Button } from '../../../ui/Button'

export const ChatInput = memo(function ChatInput({
  running,
  onSend,
  workspacePath,
  onSelectWorkspace,
  onClearWorkspace,
  autoApprove,
  onChangeAutoApprove,
  thinkingMode,
  onChangeThinkingMode,
}: {
  running: boolean
  onSend: (input: string) => void
  workspacePath?: string | null
  onSelectWorkspace?: () => void
  onClearWorkspace?: () => void
  autoApprove: boolean
  onChangeAutoApprove: (value: boolean) => void
  thinkingMode: boolean
  onChangeThinkingMode: (value: boolean) => void
}) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (input.trim()) {
      onSend(input)
      setInput('')
    }
  }

  return (
    <div className='border-border bg-background focus-within:border-primary focus-within:ring-primary/10 relative flex flex-col rounded-2xl border shadow-sm transition-all focus-within:ring-2'>
      <div className='h-0 flex-1 overflow-auto'>
        <div className='h-1.5'></div>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className='text-foreground placeholder:text-text-info w-full resize-none rounded-2xl border-0 bg-transparent px-4 focus:ring-0 focus:outline-none disabled:opacity-50'
          rows={1}
          style={{ minHeight: '52px', maxHeight: '200px' }}
        />
      </div>

      <div className='flex items-center justify-between gap-2 px-4 py-2'>
        <div className='min-w-0'>
          {onSelectWorkspace && (
            <div className='flex min-w-0 items-center gap-2'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={onSelectWorkspace}
                className='text-text-secondary hover:text-foreground gap-1.5 px-2'
                title='Select workspace'
              >
                <FolderOpen className='size-4' />
                <span className='max-w-60 truncate text-xs'>
                  {workspacePath || 'Default workspace'}
                </span>
              </Button>
              {workspacePath && onClearWorkspace && (
                <button
                  type='button'
                  onClick={onClearWorkspace}
                  className='text-text-secondary hover:text-foreground rounded p-1 transition'
                  title='Use default workspace'
                >
                  <X className='size-3.5' />
                </button>
              )}
            </div>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => onChangeThinkingMode?.(!thinkingMode)}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition ${
              thinkingMode
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-secondary hover:text-foreground'
            }`}
            title='Auto approve bash commands for this workflow'
          >
            <Aperture className='size-4' />
            <span>Thinking Mode</span>
          </button>
          <button
            type='button'
            onClick={() => onChangeAutoApprove?.(!autoApprove)}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition ${
              autoApprove
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-secondary hover:text-foreground'
            }`}
            title='Auto approve bash commands for this workflow'
          >
            <Zap className='size-4' />
            <span>Auto approve</span>
          </button>
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || running}
            className='bg-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
          >
            {running ? (
              <LoaderCircle className='size-5 animate-spin' />
            ) : (
              <Send className='size-5' />
            )}
            <span>Send</span>
          </Button>
        </div>
      </div>
    </div>
  )
})
