import { useEffect, useRef, useState, useCallback, useMemo, type PropsWithChildren } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { cn } from '../../lib/utils'
import { useSessionWorkflowIds } from '../../store/sessionStore'
import { useHistoryItem } from '../../store/historyStore'
import { useChatContext, useChatRunning } from '@/hooks/useChatContext'
import {
  ChatLayoutContext,
  ChatLayoutScrollContext,
  useChatLayout,
  useChatLayoutScroll,
} from '@/hooks/useChatLayout'
import { InitSession } from './InitSession'
import { ArrowDown, GitBranch } from 'lucide-react'
import { MessageNavigator } from '../../components/chat/MessageNavigator'
import { useNavigate } from 'react-router'
import {
  getChatPanelDefinition,
  toolbarChatPanelDefinitions,
  webSearchPanelId,
  type ChatPanelId,
} from './panels'
import { useAutoScroll } from './useAutoScroll'

const MAIN_PANEL_MIN_WIDTH = 550

export function ChatLayoutProvider({ children }: PropsWithChildren) {
  const { sessionId } = useChatContext()
  const { ref: scrollContainerRef, scrollToBottom } = useAutoScroll({ sessionId })
  const [activePanelId, setActivePanelId] = useState<ChatPanelId | null>(null)
  const activePanel = useMemo(
    () => (activePanelId ? getChatPanelDefinition(activePanelId) : null),
    [activePanelId]
  )

  const togglePane = useCallback((next: ChatPanelId) => {
    setActivePanelId((current) => (current === next ? null : next))
  }, [])

  const openPanel = useCallback((next: ChatPanelId) => {
    setActivePanelId(next)
  }, [])

  const closePane = useCallback(() => {
    setActivePanelId(null)
  }, [])

  const showWebSearchResults = useCallback(() => {
    openPanel(webSearchPanelId)
  }, [openPanel])

  const chatLayoutScrollValue = useMemo(
    () => ({
      scrollContainerRef,
      scrollToBottom,
    }),
    [scrollContainerRef, scrollToBottom]
  )

  const chatLayoutProvideValue = useMemo(
    () => ({
      isPaneOpen: activePanelId !== null,
      activePanelId,
      activePanel,
      togglePane,
      openPanel,
      showWebSearchResults,
      closePane,
    }),
    [activePanel, activePanelId, closePane, openPanel, showWebSearchResults, togglePane]
  )
  return (
    <ChatLayoutScrollContext.Provider value={chatLayoutScrollValue}>
      <ChatLayoutContext.Provider value={chatLayoutProvideValue}>
        {children}
      </ChatLayoutContext.Provider>
    </ChatLayoutScrollContext.Provider>
  )
}

export function ChatLayout({ children }: PropsWithChildren) {
  const { sessionId } = useChatContext()
  const { isPaneOpen, activePanel, activePanelId, togglePane } = useChatLayout()
  const showSidePanel = isPaneOpen && activePanel

  const mainPane = (
    <div className='relative flex h-full min-w-0 flex-1 flex-col'>
      <div className='text-text-secondary flex items-center gap-1 p-1'>
        {toolbarChatPanelDefinitions.map((panel) => {
          const Icon = panel.icon
          return (
            <button
              key={panel.id}
              type='button'
              className={cn(
                'hover:bg-foreground/5 hover:text-foreground focus-visible:ring-primary/30 inline-flex h-9 w-9 items-center justify-center rounded-full transition',
                activePanelId === panel.id && 'bg-primary/10 text-primary'
              )}
              onClick={() => togglePane(panel.id)}
              title={panel.title}
              aria-label={panel.title}
            >
              <Icon size={16} aria-hidden='true' />
            </button>
          )
        })}
      </div>

      <main
        id='chat-main-content'
        className='relative flex h-0 min-h-0 flex-1 flex-col overflow-hidden'
      >
        {children}
      </main>
    </div>
  )

  return (
    <div className='bg-background relative flex h-full flex-col overflow-hidden' id='chat-wrapper'>
      <a
        href='#chat-main-content'
        className='bg-background text-foreground sr-only rounded-full border px-3 py-2 focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-50'
      >
        Skip to Conversation
      </a>
      <InitSession sessionId={sessionId} />
      <div className='relative flex h-0 flex-1'>
        <Group className='flex-1'>
          <Panel id='chat-main-panel' minSize={`${MAIN_PANEL_MIN_WIDTH}px`}>
            {mainPane}
          </Panel>
          {showSidePanel ? (
            <>
              <Separator className='group relative w-3 cursor-col-resize bg-transparent' />
              <Panel
                id={`chat-side-panel-${activePanel.id}`}
                defaultSize={`${activePanel.defaultWidth}px`}
                groupResizeBehavior='preserve-pixel-size'
                minSize={`${activePanel.minWidth}px`}
                maxSize={activePanel.maxWidth ? `${activePanel.maxWidth}px` : undefined}
                className='border-border bg-background min-w-0 border-l'
              >
                <activePanel.Component sessionId={sessionId} />
              </Panel>
            </>
          ) : null}
        </Group>
      </div>
    </div>
  )
}

export function ChatLayoutMessage({ children }: PropsWithChildren) {
  const { sessionId } = useChatContext()
  const running = useChatRunning()
  const historyItem = useHistoryItem(sessionId)
  const workflowIds = useSessionWorkflowIds(sessionId)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [showToBottomButton, setShowToBottomButton] = useState(false)
  const { scrollContainerRef, scrollToBottom } = useChatLayoutScroll()

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
      <div ref={scrollContainerRef} className='relative h-0 flex-1 overflow-auto px-3 sm:px-4'>
        {historyItem?.type === 'fork' && historyItem.origin ? (
          <ForkOriginFooter
            originSessionId={historyItem.origin.sessionId}
            originWorkflowId={historyItem.origin.workflowId}
          />
        ) : null}
        <div className='mx-auto max-w-5xl'>{children}</div>

        <div className='h-84' ref={placeholderRef} />
      </div>

      {workflowIds.length > 1 && <MessageNavigator workflowIds={workflowIds} />}

      {showToBottomButton && (
        <button
          type='button'
          onClick={scrollToBottom}
          className={`bg-background hover:bg-foreground/4 absolute bottom-36 left-1/2 -translate-x-1/2 overflow-hidden rounded-full p-3 transition-colors ${running ? 'border-0' : 'border-border border'} `}
          aria-label='Scroll to bottom'
        >
          {running && <span className='spin-ring absolute inset-0 rounded-full'></span>}
          <span className='relative z-2'>
            <ArrowDown size={18} className='text-foreground' aria-hidden='true' />
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
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6',
        className
      )}
    >
      <div className='pointer-events-auto relative mx-auto w-full max-w-5xl'>
        {children}

        <p className='text-text-info mt-3 text-center text-xs'>
          <kbd className='bg-border/60 rounded-full px-2 py-1 font-mono text-[10px]'>Enter</kbd>
          <span className='mx-1'>to send.</span>
          <kbd className='bg-border/60 rounded-full px-2 py-1 font-mono text-[10px]'>
            Shift+Enter
          </kbd>
          <span className='mx-1'>for a new line.</span>
        </p>
      </div>
    </div>
  )
}

function ForkOriginFooter(props: { originSessionId: string; originWorkflowId: string | null }) {
  const navigate = useNavigate()
  const target = props.originWorkflowId
    ? `/chat/${props.originSessionId}#${props.originWorkflowId}`
    : `/chat/${props.originSessionId}`

  return (
    <div className='border-border bg-background sticky top-4 z-10 mx-auto mb-6 max-w-5xl rounded-2xl border px-5 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <div className='text-foreground text-sm font-medium'>Forked Session</div>
          <div className='text-text-info text-xs'>
            This conversation was forked from an earlier session point.
          </div>
        </div>
        <button
          type='button'
          onClick={() => navigate(target)}
          className='border-primary/20 bg-background hover:bg-primary/10 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition'
        >
          <GitBranch size={13} aria-hidden='true' />
          Back to Original
        </button>
      </div>
    </div>
  )
}
