import { useState } from 'react'
import type { AssistantReasonThreadMessage, ConversationBlock } from '../../store/threadStore'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'
import { Brain, ChevronDown, ChevronRight } from 'lucide-react'

export function AssistantReasonMessage({
  block,
  message,
}: {
  block: ConversationBlock
  message: AssistantReasonThreadMessage
}) {
  const isRunning = block.runtime.isStreaming && block.messages.at(-1)?.id === message.id
  const [open, setOpen] = useState(isRunning)

  if (!message.reasoning.trim()) return null

  return (
    <div className='space-y-4 text-xs'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='text-text-secondary flex items-center gap-3 font-medium'
      >
        <Brain size={16} strokeWidth={2} />
        <span>{isRunning ? 'Thinking' : 'Reason'}</span>
        {open ? (
          <ChevronDown size={16} strokeWidth={2} />
        ) : (
          <ChevronRight size={16} strokeWidth={2} />
        )}
      </button>

      {open && (
        <div className='space-y-4 pl-2'>
          <div className='border-border border-l pl-5'>
            <MarkdownRenderer
              animation={isRunning}
              className='text-text-secondary prose prose-sm dark:prose-invert max-w-none text-[12px] leading-7'
            >
              {message.reasoning}
            </MarkdownRenderer>
          </div>
        </div>
      )}
    </div>
  )
}
