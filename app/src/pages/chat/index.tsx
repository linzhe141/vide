import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatProvider, useChatContext } from './ChatProvider'
import { ArrowDown, FileText, ListChecks } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ArtifactsDisplay } from './ArtifactsDisplay'
import { PlannersDisplay } from './PlannersDisplay'
import { InitSession } from './InitSession'
import { useAutoScroll } from './useAutoScroll'
import { MessageNavigator } from './MessageNavigator'
import { useThreadBlocks } from '../../store/threadStore'

export function Chat() {
  const { id } = useParams()
  return (
    <ChatProvider threadId={id!}>
      <ChatContent key={id} />
    </ChatProvider>
  )
}

function ChatContent() {
  const { handleSend, threadId } = useChatContext()

  const placeholderRef = useRef<HTMLDivElement>(null)
  const { ref: scrollRef, scrollToBottom } = useAutoScroll()
  const [showToBottomButton, setShowToBottomButton] = useState(false)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'Artifacts' | 'Planners'>('Artifacts')
  const [moving, setMoving] = useState(false)
  const blocks = useThreadBlocks(threadId)

  const togglePane = (next: 'Artifacts' | 'Planners') => {
    setMoving(true)
    setTimeout(() => setMoving(false), 200)

    if (!open) {
      setType(next)
      setOpen(true)
      return
    }

    if (type === next) {
      setOpen(false)
    } else {
      setType(next)
    }
  }

  const onSend = useCallback(
    (text: string) => {
      handleSend(text)
      scrollToBottom()
    },
    [handleSend, scrollToBottom]
  )
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
    <div className='bg-background flex h-full flex-col' id='chat-wrapper'>
      <InitSession threadId={threadId} />
      <div className='flex h-0 flex-1'>
        {/* 主区域 */}
        <div className='flex min-w-[550px] flex-1 flex-col'>
          {/* header */}
          <div className='text-text-secondary flex h-10 items-center justify-end gap-2 px-5'>
            <ListChecks
              size={14}
              className={cn({
                'text-primary': open && type === 'Planners',
              })}
              onClick={() => togglePane('Planners')}
            />
            <FileText
              size={14}
              className={cn({
                'text-primary': open && type === 'Artifacts',
              })}
              onClick={() => togglePane('Artifacts')}
            />
          </div>

          {/* message */}
          <div ref={scrollRef} className='h-0 flex-1 overflow-auto'>
            <MessageList />
            {blocks && (
              <MessageNavigator
                items={blocks.map((i, index) => {
                  return {
                    index,
                    id: i.id,
                    label: i.input,
                  }
                })}
              />
            )}
            {showToBottomButton && (
              <button
                onClick={scrollToBottom}
                className='bg-background border-border fixed bottom-60 left-1/2 z-50 -translate-x-1/2 rounded-full border p-3 shadow-lg transition-all hover:scale-105 hover:shadow-xl'
                aria-label='Scroll to bottom'
              >
                <ArrowDown size={18} className='text-foreground' />
              </button>
            )}
            <div className='h-[200px]' ref={placeholderRef} />
          </div>

          {/* input */}
          <ChatInput onSend={onSend} />
        </div>

        {/* side pane */}
        <div
          className={cn('overflow-hidden transition-[width] duration-200', {
            'w-0': !open,
            'w-[1000px] border-l': open && type === 'Artifacts',
            'w-[600px] border-l': open && type === 'Planners',
          })}
        >
          {type === 'Artifacts' && (
            <ArtifactsDisplay threadId={threadId} className={cn({ 'whitespace-nowrap': moving })} />
          )}
          {type === 'Planners' && (
            <PlannersDisplay className={cn({ 'whitespace-nowrap': moving })} />
          )}
        </div>
      </div>
    </div>
  )
}
