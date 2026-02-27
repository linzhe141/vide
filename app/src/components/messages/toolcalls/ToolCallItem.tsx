import { memo } from 'react'
import type { ToolCall } from '@/agent/core/types'
import { NormalToolCall } from './NormalToolCall'
import { FsCreateFileToolCall } from './FsCreateFileToolCall'

export const ToolCallItem = memo(
  ({
    toolCall,
    animation,
    showApproveOperate,
  }: {
    toolCall: ToolCall & { result?: string; status: 'pending' | 'approve' | 'reject' }
    animation: boolean
    showApproveOperate: boolean
  }) => {
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
  },
  (prev, next) => {
    return (
      prev.toolCall.id === next.toolCall.id &&
      prev.toolCall.result === next.toolCall.result &&
      prev.toolCall.status === next.toolCall.status &&
      prev.toolCall.function.arguments === next.toolCall.function.arguments &&
      prev.animation === next.animation &&
      prev.showApproveOperate === next.showApproveOperate
    )
  }
)
