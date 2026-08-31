import { memo, useMemo, useState } from 'react'
import type { AssistantReasonSessionMessage } from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'

const PREVIEW_CHAR_LIMIT = 400

type AssistantReasonMessageProps = {
  message: AssistantReasonSessionMessage
}

export const AssistantReasonMessage = memo(function AssistantReasonMessage({
  message,
}: AssistantReasonMessageProps) {
  const isReasoning = message.reasoning === true
  const canExpand = message.content.trim().length > PREVIEW_CHAR_LIMIT
  const [expanded, setExpanded] = useState(false)
  const visibleContent = useMemo(() => {
    if (!canExpand || expanded) {
      return message.content
    }

    return `${message.content.slice(0, PREVIEW_CHAR_LIMIT).trimEnd()}…`
  }, [canExpand, expanded, message.content])

  return (
    <div className='space-y-2'>
      <MarkdownRenderer
        animation={isReasoning && expanded}
        className='text-text-secondary text-[12px]'
      >
        {visibleContent}
      </MarkdownRenderer>

      {canExpand && (
        <button
          type='button'
          onClick={() => setExpanded((value) => !value)}
          className='text-text-info hover:text-foreground text-[12px] font-medium transition-colors'
        >
          {expanded ? '收起' : '展开'}
        </button>
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
