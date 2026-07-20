import type {
  AssistantTextSessionMessage,
  ToolCallSessionMessage,
  ToolResultSessionMessage,
} from '../../../store/sessionStore/types'
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer'

import type { Workflow } from '../../../store/sessionStore/types'
import type { WebSearchResult } from '@/store/webSearchStore'

export function AssistantTextMessage({
  workflow,
  message,
}: {
  workflow: Workflow
  message: AssistantTextSessionMessage
}) {
  const webSearchToolMessage = workflow.messages.find(
    (t) => t.role === 'tool-call' && t.toolCalls.find((c) => c.function.name === 'websearch')
  )
  const webSearchToolId = (webSearchToolMessage as ToolCallSessionMessage)?.toolCalls.find(
    (c) => c.function.name === 'websearch'
  )?.id

  const webSearchToolResultMessage = workflow.messages.find(
    (t) => t.role === 'tool-result' && t.toolCallId === webSearchToolId
  ) as ToolResultSessionMessage | undefined
  const webSearchToolResult = webSearchToolResultMessage?.result as WebSearchResult | undefined

  const webSearchResults = webSearchToolResult?.results ?? []

  // 把 [number] 替换为对应的搜索结果链接
  const formatContent = message.content.replace(/\[(\d+)\]/g, (_, index) => {
    const i = parseInt(index, 10) - 1
    const result = webSearchResults[i]
    return result ? `[${index}](${result.link})` : `[${index}]`
  })
  return (
    <div className='max-w-none'>
      <MarkdownRenderer animation={message.streaming}>{formatContent}</MarkdownRenderer>
    </div>
  )
}
