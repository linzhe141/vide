import type { ToolCall } from '@/agent/core/types'
import { useChatContext } from './ChatProvider'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'
import { ToolCallItem } from './ToolCallItem'
import { ToolMessage } from './ToolMessage'
import { StatusIndicator, TypingIndicator, EmptyState } from './ChatUIComponents'

export function MessageList() {
  const { messages, approvedToolCalls, isRunning, placeholderRef } = useChatContext()

  return (
    <div className='flex-1 overflow-auto'>
      <div className='mx-auto max-w-4xl space-y-6 px-4 py-8'>
        {messages.length === 0 && <EmptyState />}

        {messages.map((msg, idx) => {
          switch (msg.role) {
            case 'user':
              return <UserMessage key={idx} content={msg.content as string} />

            case 'assistant':
              return (
                <div key={idx} className='space-y-3'>
                  {msg.content && <AssistantMessage content={msg.content as string} />}
                  {msg.tool_calls?.map((toolCall, index) => (
                    <ToolCallItem
                      key={`${idx}-${index}`}
                      toolCall={toolCall as ToolCall}
                      isApproved={approvedToolCalls.has(toolCall.id + idx + index)}
                      callId={toolCall.id + idx + index}
                    />
                  ))}
                </div>
              )

            case 'tool':
              return <ToolMessage key={idx} content={msg} />

            default:
              return null
          }
        })}

        {isRunning && messages.length > 0 && <TypingIndicator />}

        {messages.length > 0 && <StatusIndicator />}

        <div ref={placeholderRef} className='h-32' />
      </div>
    </div>
  )
}
