import type { ToolCall } from '@/agent/core/types'
import { useChatContext } from './ChatProvider'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'
import { ToolCallItem } from './ToolCallItem'
import { StatusIndicator, TypingIndicator, EmptyState } from './ChatUIComponents'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { useThreadStore } from '../../store/threadStore'
import { WorkflowErrorMessage } from './WorkflowErrorMessage'

export const MessageList = memo(function MessageList() {
  const messages = useThreadStore((data) => data.messages)
  const { approvedToolCalls, isRunning } = useChatContext()
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [showToBottomButton, setShowToBottomButton] = useState(false)
  console.log('xxx', showToBottomButton)
  const toBottom = useCallback(() => {
    placeholderRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setShowToBottomButton(!entry.isIntersecting)
        })
      },
      { threshold: 0.5 }
    )
    if (placeholderRef.current) {
      observer.observe(placeholderRef.current)
    }
    return () => observer.disconnect()
  }, [])
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
                <div key={idx}>
                  {msg.content && <AssistantMessage content={msg.content as string} />}
                </div>
              )
            case 'tool-call':
              return (
                <div key={idx}>
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
            case 'error':
              return (
                <div key={idx}>
                  <WorkflowErrorMessage error={msg.error}></WorkflowErrorMessage>
                </div>
              )
            default:
              return null
          }
        })}

        {isRunning && messages.length > 0 && <TypingIndicator />}

        {messages.length > 0 && <StatusIndicator />}
      </div>
      {showToBottomButton && (
        <button
          onClick={toBottom}
          className='bg-background border-border hover:bg-primary/5 fixed bottom-60 left-1/2 -translate-x-1/2 rounded-full border p-3 shadow-lg transition-all hover:scale-105 hover:shadow-xl'
          aria-label='Scroll to bottom'
        >
          <ArrowDown size={18} className='text-foreground' />
        </button>
      )}
      <div ref={placeholderRef} className='h-32' />
    </div>
  )
})
