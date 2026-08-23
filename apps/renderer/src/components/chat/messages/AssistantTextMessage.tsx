import { memo, useCallback, useMemo } from 'react'
import type { AssistantTextSessionMessage, ToolCallState } from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'
import { useWebSearchStoreActions, type WebSearchResult } from '@/store/webSearchStore'

type AssistantTextMessageProps = {
  message: AssistantTextSessionMessage
  latestWebSearchToolCall?: ToolCallState | null
}

export const AssistantTextMessage = memo(function AssistantTextMessage({
  message,
  latestWebSearchToolCall,
}: AssistantTextMessageProps) {
  const { select } = useWebSearchStoreActions()
  const webSearchResults = latestWebSearchToolCall?.result?.result?.result?.results ?? []

  // 把 [number] 替换为对应的搜索结果链接
  const formatContent = useMemo(() => {
    return message.content.replace(/\[(\d+)\]/g, (_match: string, index: string) => {
      const result = webSearchResults[parseInt(index, 10) - 1]
      // 如果 result 存在，返回 [index](result.link)，否则返回空字符串 也就是不显示任何内容 不影响使用
      return result ? `[${index}](${result.link})` : ''
    })
  }, [message.content, webSearchResults])

  const handleCitationClick = useCallback(() => {
    const toolCall = latestWebSearchToolCall?.toolCall
    if (!toolCall) return

    const query = JSON.parse(toolCall.function.arguments ?? '{}')?.query
    const webSearchResult = latestWebSearchToolCall?.result?.result?.result as WebSearchResult
    select({
      id: toolCall.id,
      query,
      result: webSearchResult,
      durationMs: latestWebSearchToolCall?.result?.durationMs,
    })
  }, [latestWebSearchToolCall, select])

  return (
    <div className='max-w-none'>
      <MarkdownRenderer animation={message.streaming} onCitationClick={handleCitationClick}>
        {formatContent}
      </MarkdownRenderer>
    </div>
  )
}, areAssistantTextMessagePropsEqual)

function areAssistantTextMessagePropsEqual(
  prev: AssistantTextMessageProps,
  next: AssistantTextMessageProps
) {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.streaming === next.message.streaming &&
    prev.latestWebSearchToolCall === next.latestWebSearchToolCall
  )
}
