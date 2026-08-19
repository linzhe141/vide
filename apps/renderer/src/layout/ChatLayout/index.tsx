import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type PropsWithChildren,
} from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { cn } from '../../lib/utils'
import { useSessionWorkflows, useSession } from '../../store/sessionStore'
import { useHistoryItems } from '../../store/historyStore'
import { useChatContext } from '../../components/chat/ChatProvider'
import { InitSession } from './InitSession'
import { ArrowDown, GitBranch } from 'lucide-react'
import { MessageNavigator } from '../../components/chat/MessageNavigator'
import { useNavigate } from 'react-router'
import {
  getChatPanelDefinition,
  toolbarChatPanelDefinitions,
  webSearchPanelId,
  type ChatPanelDefinition,
  type ChatPanelId,
} from './panels'
import { useAutoScroll } from './useAutoScroll'

const MAIN_PANEL_MIN_WIDTH = 550

interface ChatLayoutContextType {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  scrollToBottom: () => void
  isPaneOpen: boolean
  activePanelId: ChatPanelId | null
  activePanel: ChatPanelDefinition | null
  togglePane: (next: ChatPanelId) => void
  openPanel: (next: ChatPanelId) => void
  showWebSearchResults: () => void
  closePane: () => void
}

const ChatLayoutContext = createContext<ChatLayoutContextType | null>(null)
export function useChatLayout() {
  const context = useContext(ChatLayoutContext)
  if (!context) throw new Error('Must be used within ChatLayout')
  return context
}

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

  const chatLayoutProvideValue = useMemo(
    () => ({
      scrollContainerRef,
      scrollToBottom,
      isPaneOpen: activePanelId !== null,
      activePanelId,
      activePanel,
      togglePane,
      openPanel,
      showWebSearchResults,
      closePane,
    }),
    [
      activePanel,
      activePanelId,
      closePane,
      openPanel,
      scrollContainerRef,
      scrollToBottom,
      showWebSearchResults,
      togglePane,
    ]
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
  const { isPaneOpen, activePanel, activePanelId, togglePane } = useChatLayout()

  const mainPane = (
    <div className='flex h-full min-w-0 flex-1 flex-col'>
      <div className='text-text-secondary flex h-10 items-center justify-end gap-1.5 px-5'>
        {toolbarChatPanelDefinitions.map((panel) => {
          const Icon = panel.icon
          return (
            <button
              key={panel.id}
              type='button'
              className={cn(
                'hover:bg-foreground/5 hover:text-foreground rounded-lg p-1.5 transition',
                activePanelId === panel.id && 'bg-primary/10 text-primary'
              )}
              onClick={() => togglePane(panel.id)}
              title={panel.title}
              aria-label={panel.title}
            >
              <Icon size={16} />
            </button>
          )
        })}
      </div>

      <div className='relative flex h-0 flex-1 flex-col overflow-hidden'>{children}</div>
    </div>
  )

  return (
    <div className='bg-background flex h-full flex-col' id='chat-wrapper'>
      <InitSession sessionId={sessionId} />
      <div className='flex h-0 flex-1'>
        {isPaneOpen && activePanel ? (
          <Group className='flex-1'>
            <Panel minSize={`${MAIN_PANEL_MIN_WIDTH}px`}>{mainPane}</Panel>
            <Separator className='group relative w-3 cursor-col-resize bg-transparent'></Separator>
            <Panel
              defaultSize={`${activePanel.defaultWidth}px`}
              minSize={`${activePanel.minWidth}px`}
              maxSize={activePanel.maxWidth ? `${activePanel.maxWidth}px` : undefined}
              className='border-border bg-background min-w-0 border-l'
            >
              <activePanel.Component session={session} />
            </Panel>
          </Group>
        ) : (
          <div className='flex min-w-0 flex-1'>{mainPane}</div>
        )}
      </div>
    </div>
  )
}

export function ChatLayoutMessage({ children }: PropsWithChildren) {
  const { sessionId, running } = useChatContext()
  const historyItem = useHistoryItems().find((item) => item.sessionId === sessionId)
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
        {historyItem?.type === 'fork' && historyItem.origin ? (
          <ForkOriginFooter
            originSessionId={historyItem.origin.sessionId}
            originWorkflowId={historyItem.origin.workflowId}
          />
        ) : null}
        <div className='mx-auto max-w-230'>{children}</div>

        <div className='h-75' ref={placeholderRef} />
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
          className={`bg-background absolute bottom-60 left-1/2 -translate-x-1/2 overflow-hidden rounded-full p-3 shadow-lg transition-all hover:scale-105 hover:shadow-xl ${running ? 'border-0' : 'border-border border'} `}
          aria-label='Scroll to bottom'
        >
          {running && <span className='spin-ring absolute inset-0 rounded-full'></span>}
          <span className='relative z-2'>
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
    <div className={cn('relative mx-auto w-full max-w-230', className)}>
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
    <div className='border-primary/20 bg-background sticky top-0 z-10 mx-auto max-w-230 rounded-3xl border px-5 py-4'>
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
