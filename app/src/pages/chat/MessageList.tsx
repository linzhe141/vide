import type { ToolCall } from '@/agent/core/types'
import { useChatContext } from './ChatProvider'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'
import { ToolCallItem } from './ToolCallItem'
import { StatusIndicator, TypingIndicator, EmptyState } from './ChatUIComponents'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { useThreadStore } from '../../store/threadStore'
import { WorkflowErrorMessage } from './WorkflowErrorMessage'
import { MessageNavigator } from './MessageNavigator'
import { cn } from '../../lib/utils'
import { ThreadMessageRole } from '@/types'

export const MessageList = memo(function MessageList({ loading }: { loading: boolean }) {
  const blocks = useThreadStore((data) => data.blocks)
  const { isRunning } = useChatContext()
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [showToBottomButton, setShowToBottomButton] = useState(false)
  const toBottom = useCallback(() => {
    placeholderRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  const isRunningLast = (idx: number) => idx === blocks.length - 1 && isRunning
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

  const prevLengthRef = useRef(blocks.length)

  useLayoutEffect(() => {
    if (blocks.length > prevLengthRef.current) {
      const wrapper = document.getElementById('chat-wrapper')!
      wrapper.scrollTop = wrapper.scrollHeight
    }
    prevLengthRef.current = blocks.length
  }, [blocks])

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
                  <div
                    className={cn('space-y-5', {
                      // TODO
                      // 想做到chatgpt那种体验
                      // 40px titlebar height h-10
                      // 150px chatinput height
                      // 128px placeholder height h-32
                      // 180px 其他各种 其他边距
                      // 'min-h-[calc(100vh-40px-150px-128px-180px)]': isRunningLast(idx),
                    })}
                  >
                    {block.messages.map((msg, msgIndex) => {
                      switch (msg.role) {
                        case ThreadMessageRole.User:
                          return (
                            <UserMessage
                              key={msgIndex}
                              id={anchorId}
                              content={msg.content as string}
                            />
                          )

                        case ThreadMessageRole.AssistantText:
                          return (
                            <div key={msgIndex}>
                              {msg.content && (
                                <AssistantMessage
                                  content={msg.content as string}
                                  animation={isRunningLast(idx)}
                                />
                              )}
                            </div>
                          )
                        case ThreadMessageRole.ToolCalls: {
                          return (
                            <div key={msgIndex}>
                              {msg.tool_calls?.map((toolCall, index) => (
                                <ToolCallItem
                                  key={`${idx}-${index}`}
                                  toolCall={toolCall as ToolCall}
                                  callId={toolCall.id + idx + index}
                                  animation={isRunningLast(idx)}
                                />
                              ))}
                            </div>
                          )
                        }
                        case ThreadMessageRole.Error:
                          return (
                            <div key={msgIndex}>
                              <WorkflowErrorMessage error={msg.error}></WorkflowErrorMessage>
                            </div>
                          )
                        default:
                          return null
                      }
                    })}
                    {isRunningLast(idx) && <TypingIndicator />}
                  </div>
                )
              })}
            </div>

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
