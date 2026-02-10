import type { ToolCall } from '@/agent/core/types'
import { NormalToolCall } from './NormalToolCall'
import { FsCreateFileToolCall } from './FsCreateFileToolCall'
import { memo } from 'react'

export const ToolCallItem = memo(function ToolCallItem({
  toolCall,
  animation,
  showApproveOperate,
}: {
  toolCall: ToolCall & { result?: string; status: 'pending' | 'approve' | 'reject' }
  animation: boolean
  showApproveOperate: boolean
}) {
  if (toolCall.function.name === 'fs_create_file')
    return (
      <FsCreateFileToolCall
        toolCall={toolCall}
        animation={animation}
        showApproveOperate={showApproveOperate}
      ></FsCreateFileToolCall>
    )

  return (
    <NormalToolCall
      toolCall={toolCall}
      animation={animation}
      showApproveOperate={showApproveOperate}
    ></NormalToolCall>
  )
})
