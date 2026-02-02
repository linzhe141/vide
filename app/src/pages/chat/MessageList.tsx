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
import { MessageNavigator } from './MessageNavigator'

export const MessageList = memo(function MessageList({ loading }: { loading: boolean }) {
  const blocks = useThreadStore((data) => data.blocks)
  const { isRunning } = useChatContext()
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [showToBottomButton, setShowToBottomButton] = useState(false)
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
    <div className='flex-1 overflow-auto' id='chat-wrapper'>
      <div className='mx-auto max-w-4xl space-y-6 px-4 py-8'>
        {loading ? (
          <ChatSkeleton />
        ) : (
          <>
            {blocks.length === 0 && <EmptyState />}

            <div className='space-y-10'>
              {blocks.map((block, idx) => {
                const anchorId = `workflow-block-${idx}`
                return (
                  <div className='space-y-5'>
                    {block.messages.map((msg, msgIndex) => {
                      switch (msg.role) {
                        case 'user':
                          return (
                            <UserMessage
                              key={msgIndex}
                              id={anchorId}
                              content={msg.content as string}
                            />
                          )

                        case 'assistant':
                          return (
                            <div key={msgIndex}>
                              {msg.content && (
                                <AssistantMessage
                                  content={msg.content as string}
                                  animation={idx === blocks.length - 1 && isRunning}
                                />
                              )}
                            </div>
                          )
                        case 'tool-call':
                          return (
                            <div key={msgIndex}>
                              {msg.tool_calls?.map((toolCall, index) => (
                                <ToolCallItem
                                  key={`${idx}-${index}`}
                                  toolCall={toolCall as ToolCall}
                                  callId={toolCall.id + idx + index}
                                  animation={idx === blocks.length - 1 && isRunning}
                                />
                              ))}
                            </div>
                          )
                        case 'error':
                          return (
                            <div key={msgIndex}>
                              <WorkflowErrorMessage error={msg.error}></WorkflowErrorMessage>
                            </div>
                          )
                        default:
                          return null
                      }
                    })}
                  </div>
                )
              })}
            </div>

            {isRunning && blocks.length > 0 && <TypingIndicator />}

            {blocks.length > 0 && <StatusIndicator />}
            {
              <MessageNavigator
                items={blocks.map((i, index) => ({
                  index: index,
                  id: `workflow-block-${index}`,
                  label: i.userMessage.content as string,
                }))}
              />
            }
          </>
        )}
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

const ChatSkeleton = () => {
  return (
    <>
      {[1, 2, 3].map((item) => (
        <div key={item} className='space-y-3'>
          {/* Avatar and name row */}
          <div className='flex items-center gap-3'>
            <div className='bg-border h-6 w-50 animate-pulse rounded-xl' />
          </div>

          {/* Message content lines */}
          <div className='space-y-2'>
            <div className='bg-border h-6 w-5/6 animate-pulse rounded' />
            <div className='bg-border h-6 w-4/6 animate-pulse rounded' />
            <div className='bg-border h-6 w-4/6 animate-pulse rounded' />
          </div>
        </div>
      ))}
    </>
  )
}
