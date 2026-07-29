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
import { useSessionWorkflows, useSessionPlanners, useSession } from '../../store/sessionStore'
import { useChatContext } from '../../components/chat/ChatProvider'
import { InitSession } from './InitSession'
import { ArrowDown, ChevronDown, ChevronUp, FileText, GitBranch, ListChecks } from 'lucide-react'
import { ArtifactsDisplay } from './ArtifactsDisplay'
import { Planner, PlannersDisplay } from './PlannersDisplay'
import { MessageNavigator } from '../../components/chat/MessageNavigator'
import { useNavigate } from 'react-router'
import { WebSearchDisplay } from './WebSearchDisplay'

interface ChatLayoutContextType {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  scrollToBottom: () => void
  open: boolean
  moving: boolean
  type: 'Artifacts' | 'Planners' | 'WebSearch'
  togglePane: (next: 'Artifacts' | 'Planners' | 'WebSearch') => void
  showWebSearchResults: () => void
  closePane?: () => void
}

const ChatLayoutContext = createContext<ChatLayoutContextType | null>(null)
export function useChatLayout() {
  const context = useContext(ChatLayoutContext)
  if (!context) throw new Error('Must be used within ChatLayout')
  return context
}

export function ChatLayoutProvider({ children }: PropsWithChildren) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'Artifacts' | 'Planners' | 'WebSearch'>('Artifacts')
  const [moving, setMoving] = useState(false)

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  const startMoving = useCallback(() => {
    setMoving(true)
    setTimeout(() => setMoving(false), 200)
  }, [])

  const togglePane = useCallback(
    (next: 'Artifacts' | 'Planners' | 'WebSearch') => {
      startMoving()

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
    },
    [open, startMoving, type]
  )

  const showWebSearchResults = useCallback(() => {
    startMoving()
    setType('WebSearch')
    setOpen(true)
  }, [startMoving])

  const chatLayoutProvideValue = useMemo(
    () => ({
      scrollContainerRef,
      scrollToBottom,
      open,
      moving,
      type,
      togglePane,
      showWebSearchResults,
      closePane: () => {
        setOpen(false)
      },
    }),
    [open, moving, scrollToBottom, showWebSearchResults, togglePane, type]
  )
  return (
    <ChatLayoutContext.Provider value={chatLayoutProvideValue}>
      {children}
    </ChatLayoutContext.Provider>
  )
}

export function ChatLayout({ children }: PropsWithChildren) {
  const { sessionId } = useChatContext()
  const { open, type, moving, togglePane } = useChatLayout()
  return (
    <div className='bg-background flex h-full flex-col' id='chat-wrapper'>
      <InitSession sessionId={sessionId} />
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

          <div className='relative flex h-0 flex-1 flex-col overflow-hidden'>{children}</div>
        </div>

        {/* side pane */}
        <div
          className={cn('overflow-hidden transition-[width] duration-200', {
            'w-0': !open,
            'w-[1000px] border-l': open && type === 'Artifacts',
            'w-[600px] border-l': open && type === 'Planners',
            'w-[520px] border-l': open && type === 'WebSearch',
          })}
        >
          {type === 'Artifacts' && (
            <ArtifactsDisplay
              sessionId={sessionId}
              className={cn({ 'whitespace-nowrap': moving })}
            />
          )}
          {type === 'Planners' && (
            <PlannersDisplay className={cn({ 'whitespace-nowrap': moving })} />
          )}
          {type === 'WebSearch' && (
            <WebSearchDisplay className={cn({ 'whitespace-nowrap': moving })} />
          )}
        </div>
      </div>
    </div>
  )
}

export function ChatLayoutMessage({ children }: PropsWithChildren) {
  const { sessionId, running } = useChatContext()
  const session = useSession(sessionId)
  const workflows = useSessionWorkflows(sessionId)
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
    <>
      <div ref={scrollContainerRef} className='relative h-0 flex-1 overflow-auto'>
        {session?.sessionType === 'fork' && session.origin ? (
          <ForkOriginFooter
            originSessionId={session.origin.sessionId}
            originWorkflowId={session.origin.workflowId}
          />
        ) : null}
        <div className='mx-auto max-w-[920px]'>{children}</div>

        <div className='h-[500px]' ref={placeholderRef} />
      </div>

      {workflows && (
        <MessageNavigator
          items={workflows.map((i, index) => {
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
          className={`bg-background absolute bottom-[240px] left-1/2 -translate-x-1/2 overflow-hidden rounded-full p-3 shadow-lg transition-all hover:scale-105 hover:shadow-xl ${running ? 'border-0' : 'border-border border'} `}
          aria-label='Scroll to bottom'
        >
          {running && <span className='spin-ring absolute inset-0 rounded-full'></span>}
          <span className='relative z-[2]'>
            <ArrowDown size={18} className='text-foreground' />
          </span>
        </button>
      )}
    </>
  )
}

export function ChatLayoutInput({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  const { sessionId } = useChatContext()
  const planners = useSessionPlanners(sessionId)
  const [isExpanded, setIsExpanded] = useState(false)

  // const pendingPlanner = planners?.[0] // for test
  const pendingPlanner = planners?.find((i) => i.plan.some((i) => i.status !== 'completed'))

  const todos =
    pendingPlanner || planners?.filter((i) => i.plan.every((i) => i.status === 'completed'))?.pop() // pop() 获取最后一个
  return (
    <div className={cn('relative mx-auto w-full max-w-[920px]', className)}>
      {todos && (
        <div className='absolute bottom-full left-0 z-10 w-full'>
          <div className='flex justify-center'>
            <div
              className={cn(
                'border-border bg-background/80 w-9/10 rounded-xl rounded-b-none border border-b-0 transition-all duration-200',
                !isExpanded && 'rounded-xl rounded-b-none'
              )}
            >
              {/* Header with toggle */}
              <div
                className='flex items-center justify-between px-4 py-2'
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
                  <span>Tasks</span>
                  <span className='bg-border/50 rounded-full px-1.5 py-0.5 text-[10px]'>
                    {todos.plan.filter((i) => i.status !== 'completed').length}
                  </span>
                </div>
                <button
                  className='text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md p-1 transition-colors'
                  aria-label={isExpanded ? 'Collapse tasks' : 'Expand tasks'}
                >
                  {isExpanded ? (
                    <ChevronUp className='h-4 w-4' />
                  ) : (
                    <ChevronDown className='h-4 w-4' />
                  )}
                </button>
              </div>

              {/* Collapsible content */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200 ease-in-out',
                  isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                <div className='border-border border-t px-4 py-3'>
                  <Planner planner={todos} />
                </div>
              </div>
            </div>
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

function ForkOriginFooter(props: { originSessionId: string; originWorkflowId: string | null }) {
  const navigate = useNavigate()
  const target = props.originWorkflowId
    ? `/chat/${props.originSessionId}#${props.originWorkflowId}`
    : `/chat/${props.originSessionId}`

  return (
    <div className='border-primary/20 bg-background sticky top-0 z-10 mx-auto max-w-[920px] rounded-3xl border px-5 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <div className='text-foreground text-sm font-medium'>Forked session</div>
          <div className='text-text-info text-xs'>
            This conversation was forked from an earlier session point.
          </div>
        </div>
        <button
          type='button'
          onClick={() => navigate(target)}
          className='border-primary/20 bg-background hover:bg-primary/10 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition'
        >
          <GitBranch size={13} />
          Back to original
        </button>
      </div>
    </div>
  )
}
