import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type PropsWithChildren,
} from 'react'
import { cn } from '../../lib/utils'
import { useThreadBlocks, useThreadPlanners } from '../../store/threadStore'
import { useChatContext } from '../../components/chat/ChatProvider'
import { InitSession } from './InitSession'
import { ArrowDown, FileText, ListChecks } from 'lucide-react'
import { ArtifactsDisplay } from './ArtifactsDisplay'
import { Planner, PlannersDisplay } from './PlannersDisplay'
import { MessageNavigator } from '../../components/chat/MessageNavigator'

interface ChatLayoutContextType {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  scrollToBottom: () => void
}

const ChatLayoutContext = createContext<ChatLayoutContextType | null>(null)
export function useChatLayout() {
  const context = useContext(ChatLayoutContext)
  if (!context) throw new Error('Must be used within ChatLayout')
  return context
}

export function ChatLayoutProvider({ children }: PropsWithChildren) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])
  const chatLayoutProvideValue = useMemo(
    () => ({ scrollContainerRef, scrollToBottom }),
    [scrollToBottom]
  )
  return (
    <ChatLayoutContext.Provider value={chatLayoutProvideValue}>
      {children}
    </ChatLayoutContext.Provider>
  )
}

export function ChatLayout({ children }: PropsWithChildren) {
  const { threadId } = useChatContext()

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'Artifacts' | 'Planners'>('Artifacts')
  const [moving, setMoving] = useState(false)

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

          <div className='flex h-0 flex-1 flex-col overflow-hidden'>{children}</div>
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

export function ChatLayoutMessage({ children }: PropsWithChildren) {
  const { threadId } = useChatContext()
  const blocks = useThreadBlocks(threadId)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [showToBottomButton, setShowToBottomButton] = useState(false)
  const { scrollContainerRef, scrollToBottom } = useChatLayout()

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
    <div ref={scrollContainerRef} className='h-0 flex-1 overflow-auto'>
      <div className='mx-auto max-w-[920px]'>{children}</div>
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
  )
}

export function ChatLayoutInput({ children }: PropsWithChildren) {
  const { threadId } = useChatContext()
  const planners = useThreadPlanners(threadId)
  const pendingPlanner = planners?.find((i) => i.plan.some((i) => i.status !== 'completed'))
  return (
    <div className='mx-auto w-full max-w-[920px]'>
      {pendingPlanner && (
        <div className='flex justify-center'>
          <div className='border-border w-9/10 rounded-xl rounded-ee-none rounded-es-none border border-b-0 py-3'>
            <Planner planner={pendingPlanner} />
          </div>
        </div>
      )}
      {children}
      <p className='text-text-info my-2 text-center text-xs'>
        <kbd className='bg-border/50 rounded px-1.5 py-0.5 font-mono text-[10px]'>Enter</kbd>
        to send,
        <kbd className='bg-border/50 rounded px-1.5 py-0.5 font-mono text-[10px]'>Shift+Enter</kbd>
        for new line
      </p>
    </div>
  )
}
