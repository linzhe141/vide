import { memo, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { MarkdownRenderer } from '@/app/src/components/markdown/MarkdownRenderer'
import type { ToolCall } from '@/agent/core/types'
import { BaseToolCallLayout } from './BaseToolCallLayout'

function extractPreview(argStr: string) {
  const result: {
    filepath: string
    content: string
  } = { filepath: '', content: '' }

  // filepath
  const filepathMatch = argStr.match(/"filepath"\s*:\s*"([^"]+)"/)
  if (filepathMatch) {
    result.filepath = filepathMatch[1]
  }

  // content
  const key = '"content": "'
  const start = argStr.indexOf(key)
  if (start !== -1) {
    const content = argStr.slice(start + key.length)

    const fileContent = content.match(/^(.+?)", "mode": "/)
    if (fileContent) {
      const matched = fileContent[1]
      result.content = matched.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    } else {
      result.content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
  }

  return result
}

export const FsCreateFileToolCall = memo(
  ({
    toolCall,
    animation,
    showApproveOperate,
  }: {
    toolCall: ToolCall & { result?: string; status: 'pending' | 'approve' | 'reject' }
    animation: boolean
    showApproveOperate: boolean
  }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    const fileInfo = useMemo(
      () => extractPreview(toolCall.function.arguments),
      [toolCall.function.arguments]
    )

    const fileType = useMemo(
      () => fileInfo.filepath?.split('.').at(-1) || 'text',
      [fileInfo.filepath]
    )

    const isUpdating = useMemo(() => {
      try {
        JSON.parse(toolCall.function.arguments)
        return false
      } catch {
        return true
      }
    }, [toolCall.function.arguments])

    const toolCallResult = useMemo(() => {
      if (!toolCall.result) return null
      try {
        return JSON.parse(toolCall.result)
      } catch {
        return toolCall.result
      }
    }, [toolCall.result])

    return (
      <BaseToolCallLayout
        toolCall={toolCall}
        animation={animation}
        showApproveOperate={showApproveOperate}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        showChevron={!isUpdating}
        isUpdating={isUpdating}
      >
        <div className='text-text-secondary my-2 flex items-center gap-2 space-y-1 text-sm'>
          {!toolCall.result && (
            <>
              <Loader2 className='h-4 w-4 animate-spin text-gray-500' />
              <span>正在写入：{fileInfo.filepath}</span>
            </>
          )}
        </div>
        {fileInfo.content && (
          <MarkdownRenderer
            className='bg-background text-text-secondary max-h-[500px] overflow-auto rounded-lg font-mono text-xs'
            animation={animation}
          >
            {'```' +
              fileType +
              '\n' +
              (isUpdating ? fileInfo.content : JSON.parse(toolCall.function.arguments).content) +
              '\n```'}
          </MarkdownRenderer>
        )}

        {toolCallResult && (
          <div className='text-text-secondary my-2 space-y-1 text-sm'>
            <div>{toolCallResult.message}</div>
            <div>{toolCallResult.fullPath}</div>
          </div>
        )}
      </BaseToolCallLayout>
    )
  }
)

FsCreateFileToolCall.displayName = 'FsCreateFileToolCall'

