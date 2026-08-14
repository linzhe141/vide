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
import { useSessionWorkflows, useSession } from '../../store/sessionStore'
import { useChatContext } from '../../components/chat/ChatProvider'
import { InitSession } from './InitSession'
import { ArrowDown, FolderTree, GitBranch } from 'lucide-react'
import { MessageNavigator } from '../../components/chat/MessageNavigator'
import { useNavigate } from 'react-router'
import { WebSearchDisplay } from './WebSearchDisplay'
import { WorkspaceExplorerPane } from './WorkspaceExplorer'

interface ChatLayoutContextType {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  scrollToBottom: () => void
  open: boolean
  moving: boolean
  type: 'Artifacts' | 'WebSearch'
  togglePane: (next: 'Artifacts' | 'WebSearch') => void
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
  const [type, setType] = useState<'Artifacts' | 'WebSearch'>('Artifacts')
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
    (next: 'Artifacts' | 'WebSearch') => {
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
  const session = useSession(sessionId)
  const { open, type, togglePane } = useChatLayout()
  return (
    <div className='bg-background flex h-full flex-col' id='chat-wrapper'>
      <InitSession sessionId={sessionId} />
      <div className='flex h-0 flex-1'>
        {/* 主区域 */}
        <div className='flex min-w-[550px] flex-1 flex-col'>
          {/* header */}
          <div className='text-text-secondary flex h-10 items-center justify-end gap-2 px-5'>
            <FolderTree
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
            'w-[2000px] border-l': open && type === 'Artifacts',
            'w-[520px] border-l': open && type === 'WebSearch',
          })}
        >
          {type === 'Artifacts' && <WorkspaceExplorerPane workspacePath={session?.workspacePath} />}
          {type === 'WebSearch' && <WebSearchDisplay />}
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

        <div className='h-[300px]' ref={placeholderRef} />
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
  return (
    <div className={cn('relative mx-auto w-full max-w-[920px]', className)}>
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
