import { memo, useCallback, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { AssistantReasonSessionMessage } from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'

type AssistantReasonMessageProps = {
  message: AssistantReasonSessionMessage
}

export const AssistantReasonMessage = memo(function AssistantReasonMessage({
  message,
}: AssistantReasonMessageProps) {
  const isReasoning = message.reasoning === true
  const [open, setOpen] = useState(isReasoning)
  const toggleOpen = useCallback(() => {
    setOpen((value) => !value)
  }, [])

  return (
    <div className='space-y-4 text-xs'>
      <button
        onClick={toggleOpen}
        className='text-text-secondary flex items-center gap-3 font-medium'
      >
        <span>{isReasoning ? 'Thinking' : 'Reason'}</span>
        {open ? (
          <ChevronDown size={16} strokeWidth={2} />
        ) : (
          <ChevronRight size={16} strokeWidth={2} />
        )}
      </button>

      {open && (
        <div className='space-y-4 pl-2'>
          <div className='border-border border-l pl-5'>
            <MarkdownRenderer animation={isReasoning} className='text-text-secondary text-[12px]'>
              {message.content}
            </MarkdownRenderer>
          </div>
        </div>
      )}
    </div>
  )
}, areAssistantReasonMessagePropsEqual)

function areAssistantReasonMessagePropsEqual(
  prev: AssistantReasonMessageProps,
  next: AssistantReasonMessageProps
) {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.reasoning === next.message.reasoning
  )
}
