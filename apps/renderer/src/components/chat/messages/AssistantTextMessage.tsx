import type { AssistantTextSessionMessage } from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'
import { useMemo } from 'react'

import type { Workflow } from '../../../store/sessionStore/types'
import { useWebSearchStoreActions, type WebSearchResult } from '@/store/webSearchStore'

export function AssistantTextMessage({
  workflow,
  message,
}: {
  workflow: Workflow
  message: AssistantTextSessionMessage
}) {
  const { select } = useWebSearchStoreActions()

  const closestWebSearchToolCallMessage = useMemo(() => {
    const toolCallMessage = workflow.messages.findLast((m) => m.role === 'tool-call')
    if (!toolCallMessage) return null
    const webSearchToolCall = toolCallMessage.toolCalls.find(
      (t) => t.toolCall.function.name === 'websearch'
    )
    return webSearchToolCall ?? null
  }, [workflow.messages])

  // 把 [number] 替换为对应的搜索结果链接
  const formatContent = useMemo(() => {
    const webSearchResults = closestWebSearchToolCallMessage?.result?.result?.result?.results ?? []
    return message.content.replace(/\[(\d+)\]/g, (_, index) => {
      const i = parseInt(index, 10) - 1
      const result = webSearchResults[i]
      // 如果 result 存在，返回 [index](result.link)，否则返回空字符串 也就是不显示任何内容 不影响使用
      return result ? `[${index}](${result.link})` : ``
    })
  }, [closestWebSearchToolCallMessage, message.content])

  const handleCitationClick = () => {
    const toolCall = closestWebSearchToolCallMessage?.toolCall
    const query = JSON.parse(toolCall?.function.arguments ?? '{}')?.query
    const webSearchResult = closestWebSearchToolCallMessage?.result?.result
      ?.result as WebSearchResult
    select({
      id: toolCall?.id ?? '',
      query: query,
      result: webSearchResult,
      durationMs: closestWebSearchToolCallMessage?.result?.durationMs,
    })
  }

  return (
    <div className='max-w-none'>
      <MarkdownRenderer animation={message.streaming} onCitationClick={handleCitationClick}>
        {formatContent}
      </MarkdownRenderer>
    </div>
  )
}
