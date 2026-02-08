import type { ToolCall } from '@/agent/core/types'
import { NormalToolCall } from './NormalToolCall'
import { FsCreateFileToolCall } from './FsCreateFileToolCall'
import { memo } from 'react'

export const ToolCallItem = memo(function ToolCallItem({
  toolCall,
  callId,
  animation,
}: {
  toolCall: ToolCall & { result?: string }
  callId: string
  animation: boolean
}) {
  if (toolCall.function.name === 'fs_create_file')
    return (
      <FsCreateFileToolCall
        toolCall={toolCall}
        callId={callId}
        animation={animation}
      ></FsCreateFileToolCall>
    )

  return <NormalToolCall toolCall={toolCall} callId={callId} animation={animation}></NormalToolCall>
})
