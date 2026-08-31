import { Aperture, FolderOpen, Send, Square, X, Zap } from 'lucide-react'
import { useState, useRef, useEffect, memo } from 'react'
import { Textarea } from '../../../ui/Textarea'
import { Button } from '../../../ui/Button'

export const ChatInput = memo(function ChatInput({
  running,
  onSend,
  onStop,
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
  onStop?: () => void
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
  const hasInput = input.trim().length > 0

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (!hasInput) return

    onSend(input)
    setInput('')
  }

  return (
    <form
      className='border-border bg-background focus-within:border-primary focus-within:ring-primary/10 relative flex flex-col rounded-2xl border focus-within:ring-2'
      aria-label='Chat Composer'
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <div className='h-0 flex-1 overflow-auto'>
        <div className='h-1.5' />
        <div className='px-4'>
          <div className='text-text-info mb-2 flex items-center justify-between gap-2 text-xs'>
            <span className='inline-flex items-center gap-1.5'>
              <Aperture className='size-3.5' aria-hidden='true' />
              Workspace Chat
            </span>
            <span className='hidden items-center gap-1 sm:flex'>
              <kbd className='bg-border/60 rounded-full px-2 py-1 font-mono text-[10px]'>Enter</kbd>
              <span>{running ? 'Queue Steering' : 'Send'}</span>
            </span>
          </div>
          {running ? (
            <div className='border-primary/20 bg-primary/6 text-primary mb-3 rounded-2xl border px-3 py-2 text-xs leading-5'>
              The workflow is still running. New messages will be queued as steering and injected
              after the current tool step or just before completion.
            </div>
          ) : null}
          <label htmlFor='chat-composer-input' className='sr-only'>
            Message
          </label>
          <Textarea
            id='chat-composer-input'
            ref={textareaRef}
            name='prompt'
            autoComplete='off'
            placeholder={
              running ? 'Add steering for the current workflow…' : 'Ask about this project…'
            }
            aria-describedby='chat-composer-help'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            className='text-foreground placeholder:text-text-info w-full resize-none rounded-2xl border-0 bg-transparent px-0 py-0 text-[15px] leading-7 shadow-none focus-visible:ring-0 focus-visible:outline-none disabled:opacity-50'
            rows={1}
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />
          <p id='chat-composer-help' className='sr-only'>
            Press Enter to send. While the workflow is running, Enter queues a steering message.
            Press Shift plus Enter for a new line.
          </p>
        </div>
      </div>

      <div className='flex items-center justify-between gap-2 px-4 py-2'>
        <div className='min-w-0'>
          {onSelectWorkspace ? (
            <div className='flex min-w-0 items-center gap-2'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={onSelectWorkspace}
                className='text-text-secondary hover:text-foreground gap-1.5 px-2'
                title='Select workspace'
              >
                <FolderOpen className='size-4' aria-hidden='true' />
                <span className='max-w-60 truncate text-xs'>
                  {workspacePath || 'Default workspace'}
                </span>
              </Button>
              {workspacePath && onClearWorkspace && (
                <button
                  type='button'
                  onClick={onClearWorkspace}
                  className='text-text-secondary hover:text-foreground rounded p-1'
                  title='Use default workspace'
                  aria-label='Use default workspace'
                >
                  <X className='size-3.5' aria-hidden='true' />
                </button>
              )}
            </div>
          ) : workspacePath ? (
            <div className='border-border text-text-secondary inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs'>
              <FolderOpen className='size-4 shrink-0' aria-hidden='true' />
              <span className='truncate'>{workspacePath}</span>
            </div>
          ) : null}
        </div>

        <div className='flex items-center gap-2'>
          {running ? (
            <Button
              type='button'
              onClick={onStop}
              className='border-border text-text-secondary hover:text-foreground flex items-center gap-1.5 rounded-lg border bg-transparent px-3 py-1.5 text-sm font-medium'
            >
              <Square className='size-4 fill-current' aria-hidden='true' />
              <span>Stop</span>
            </Button>
          ) : null}
          <button
            type='button'
            onClick={() => onChangeThinkingMode(!thinkingMode)}
            aria-pressed={thinkingMode}
            className={toggleButtonClassName(thinkingMode)}
            title='Toggle Thinking Mode'
          >
            <Aperture className='size-4' aria-hidden='true' />
            <span>Thinking Mode</span>
          </button>
          <button
            type='button'
            onClick={() => onChangeAutoApprove(!autoApprove)}
            aria-pressed={autoApprove}
            className={toggleButtonClassName(autoApprove)}
            title='Toggle Auto Approve'
          >
            <Zap className='size-4' aria-hidden='true' />
            <span>Auto Approve</span>
          </button>
          <Button
            type='submit'
            disabled={!hasInput}
            className='bg-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
          >
            <>
              <Send className='size-5' aria-hidden='true' />
              <span>{running ? 'Steer' : 'Send'}</span>
            </>
          </Button>
        </div>
      </div>
    </form>
  )
})

function toggleButtonClassName(active: boolean) {
  return `flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
    active
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border text-text-secondary hover:text-foreground'
  }`
}
