import {
  Bot,
  Brain,
  CheckCircle2,
  CircleAlert,
  Download,
  FileClock,
  LoaderCircle,
  MessageSquareText,
  Play,
  SquareTerminal,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/hooks/useChatContext'
import { useSession, useSessionWorkflows } from '@/store/sessionStore'
import type { Workflow, WorkflowLogEvent } from '@/store/sessionStore/types'
import { useChatLayout } from '@/hooks/useChatLayout'

const INITIAL_VISIBLE_LOGS = 10
const LOGS_PAGE_SIZE = 10

export function SessionLogPane({ className }: { className?: string }) {
  const { closePane } = useChatLayout()
  const { sessionId } = useChatContext()
  const session = useSession(sessionId)
  const workflows = useSessionWorkflows(sessionId) ?? []
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const totalEvents = workflows.reduce(
    (count, workflow) => count + getVisibleEvents(workflow).length,
    0
  )

  const handleExport = () => {
    if (!session) return

    const payload = {
      sessionId: session.sessionId,
      activeBranch: session.activeBranch,
      exportedAt: new Date().toISOString(),
      workflows: Object.values(session.workflowNodesMap).map((node) => ({
        id: node.workflow.id,
        parentWorkflowId: node.parent,
        childWorkflowIds: node.children,
        input: node.workflow.input,
        inputSource: node.workflow.inputSource,
        status: node.workflow.runtime.status,
        logs: node.workflow.events ?? [],
      })),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${session.sessionId}-log.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <div className={cn('bg-background flex h-full flex-col', className)}>
      <div className='border-border bg-background/92 supports-backdrop-filter:bg-background/80 flex items-center gap-3 border-b px-4 py-3 backdrop-blur'>
        <div className='bg-primary/8 text-primary border-primary/10 rounded-xl border p-1.5 shadow-sm'>
          <FileClock size={15} strokeWidth={1.9} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-foreground truncate text-sm font-medium'>Session log</div>
          <div className='text-text-secondary mt-0.5 flex items-center gap-2 text-xs'>
            <span>{workflows.length} workflows</span>
            <span className='bg-border/80 h-1 w-1 rounded-full' aria-hidden='true' />
            <span>{totalEvents} events</span>
          </div>
        </div>
        <button
          type='button'
          className='text-text-secondary hover:bg-foreground/5 hover:text-foreground rounded-lg p-1.5 transition disabled:cursor-not-allowed disabled:opacity-50'
          onClick={handleExport}
          title='Export full session log'
          aria-label='Export full session log'
          disabled={!session || workflows.length === 0}
        >
          <Download size={16} />
        </button>
        <button
          type='button'
          className='text-text-secondary hover:bg-foreground/5 hover:text-foreground rounded-lg p-1.5 transition'
          onClick={closePane}
          title='Close pane'
          aria-label='Close pane'
        >
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRootRef} className='bg-foreground/1.5 h-0 flex-1 overflow-auto px-4 py-4'>
        {workflows.length === 0 ? (
          <div className='border-border bg-background/82 mx-auto mt-8 max-w-sm rounded-2xl border px-5 py-6 text-center shadow-sm'>
            <div className='bg-primary/8 text-primary border-primary/10 mx-auto flex size-10 items-center justify-center rounded-2xl border'>
              <FileClock size={18} strokeWidth={1.8} />
            </div>
            <div className='text-foreground mt-3 text-sm font-medium'>No workflow logs yet</div>
            <div className='text-text-secondary mt-1 text-sm leading-6'>
              Workflow events will appear here after the session starts using tools or models.
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            {workflows.map((workflow, index) => (
              <WorkflowLogSection
                key={workflow.id}
                index={index}
                workflow={workflow}
                scrollRootRef={scrollRootRef}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WorkflowLogSection({
  index,
  workflow,
  scrollRootRef,
}: {
  index: number
  workflow: Workflow
  scrollRootRef: React.RefObject<HTMLDivElement | null>
}) {
  const events = getVisibleEvents(workflow)
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(events.length, INITIAL_VISIBLE_LOGS)
  )
  const previousLengthRef = useRef(events.length)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const previousLength = previousLengthRef.current
    previousLengthRef.current = events.length

    setVisibleCount((current) => {
      const cappedCurrent = Math.min(current, events.length)

      if (cappedCurrent >= previousLength) {
        return Math.min(events.length, cappedCurrent + Math.max(events.length - previousLength, 0))
      }

      return cappedCurrent
    })
  }, [events.length])

  const visibleEvents = events.slice(0, visibleCount)
  const hasMore = visibleCount < events.length

  useEffect(() => {
    const root = scrollRootRef.current
    const target = sentinelRef.current
    if (!root || !target || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        setVisibleCount((current) => Math.min(events.length, current + LOGS_PAGE_SIZE))
      },
      {
        root,
        rootMargin: '0px 0px 180px 0px',
      }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [events.length, hasMore, scrollRootRef, visibleCount])

  return (
    <section className='bg-background/86 sticky border shadow-sm'>
      <div className='bg-background sticky top-2 z-1 flex items-start gap-3 border-b px-4 py-3.5'>
        <div className='bg-primary/10 text-primary border-primary/10 mt-0.5 rounded-xl border p-1.5'>
          <MessageSquareText size={14} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='text-foreground text-sm font-medium'>Workflow {index + 1}</span>
            <StatusPill status={workflow.runtime.status} />
          </div>
          <div className='text-text-secondary mt-1 line-clamp-2 text-xs leading-5'>
            {workflow.input}
          </div>
          <div className='text-text-info mt-2 flex items-center gap-2 text-[11px]'>
            <span>{events.length} entries</span>
            <span className='bg-border h-1 w-1 rounded-full' aria-hidden='true' />
            <span>{lastEventLabel(events)}</span>
          </div>
        </div>
        <span className='bg-foreground/4 text-text-info rounded-full px-2 py-1 font-mono text-[10px]'>
          {shortId(workflow.id)}
        </span>
      </div>

      <div className='px-3 py-3'>
        <div className='before:bg-border/70 relative space-y-2.5 before:absolute before:top-3 before:bottom-3 before:left-4.25 before:w-px'>
          {visibleEvents.map((event) => (
            <LogRow key={event.id} event={event} />
          ))}
          {hasMore && (
            <div ref={sentinelRef} className='pl-8'>
              <div className='border-border/60 bg-background/70 text-text-info rounded-xl border border-dashed px-3 py-2 text-center text-xs'>
                Scroll to load more logs
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function shouldLog(type: string) {
  return type !== 'workflow.llm.reason.delta' && type !== 'workflow.llm.text.delta'
}

function LogRow({ event }: { event: WorkflowLogEvent }) {
  const meta = eventMeta(event.type)

  return (
    <div className='relative pl-8'>
      <span
        className={cn(
          'bg-background absolute top-3 left-2.75 flex size-3 items-center justify-center rounded-full border-2',
          toneClass(meta.tone, 'border')
        )}
        aria-hidden='true'
      >
        <meta.icon size={8} strokeWidth={2.2} className={toneClass(meta.tone, 'text')} />
      </span>
      <div className='border-border/60 bg-background/82 hover:border-border min-w-0 rounded-xl border px-3 py-2.5 transition'>
        <div className='flex min-w-0 items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <span
                className={cn('shrink-0 rounded-md p-1', toneClass(meta.tone, 'badge'))}
                aria-hidden='true'
              >
                <meta.icon size={12} strokeWidth={1.9} />
              </span>
              <span className={cn('truncate font-mono text-xs', toneClass(meta.tone, 'text'))}>
                {eventLabel(event.type)}
              </span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  toneClass(meta.tone, 'badge')
                )}
              >
                {eventGroup(event.type)}
              </span>
            </div>
          </div>
          <span className='text-text-info shrink-0 font-mono text-[10px]'>
            {formatTime(event.createdAt)}
          </span>
        </div>
        {event.payload !== undefined && (
          <pre className='bg-foreground/[0.035] text-text-secondary mt-2 max-h-32 overflow-auto rounded-lg p-2 font-mono text-[11px] leading-5'>
            {stringifyPayload(event.payload)}
          </pre>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: Workflow['runtime']['status'] }) {
  const tone =
    status === 'finished'
      ? 'success'
      : status === 'running'
        ? 'primary'
        : status === 'error' || status === 'aborted'
          ? 'danger'
          : 'warning'

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
        toneClass(tone, 'badge')
      )}
    >
      {status}
    </span>
  )
}

function eventLabel(type: string) {
  return type.replace(/^workflow\./, '').replaceAll('.', ' ')
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value)
}

function shortId(id: string) {
  return id.slice(0, 8)
}

function getVisibleEvents(workflow: Workflow) {
  return (workflow.events ?? []).filter((event) => shouldLog(event.type))
}

function lastEventLabel(events: WorkflowLogEvent[]) {
  if (events.length === 0) return 'No activity'
  return `Last update ${formatTime(events[events.length - 1].createdAt)}`
}

function stringifyPayload(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

type Tone = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'muted'

type EventMeta = {
  icon: LucideIcon
  tone: Tone
}

function eventGroup(type: string) {
  if (type.includes('.tool.')) return 'tool'
  if (type.includes('.llm.')) return 'llm'
  if (type.includes('.message.')) return 'message'
  return 'flow'
}

function eventTone(type: string): Tone {
  if (type.includes('error') || type.includes('abort')) return 'danger'
  if (type.includes('interrupt')) return 'warning'
  if (type.includes('finish') || type.includes('complete')) return 'success'
  if (type.includes('start')) return 'warning'
  if (type.includes('.tool.') || type.includes('.llm.')) return 'primary'
  return 'muted'
}

function eventMeta(type: string): EventMeta {
  if (type.includes('error')) return { icon: CircleAlert, tone: 'danger' }
  if (type.includes('abort')) return { icon: X, tone: 'danger' }
  if (type.includes('interrupt')) return { icon: CircleAlert, tone: 'warning' }
  if (type.includes('complete') || type.includes('success') || type.includes('result')) {
    return { icon: CheckCircle2, tone: 'success' }
  }
  if (type.includes('.tool.')) return { icon: SquareTerminal, tone: eventTone(type) }
  if (type.includes('.llm.reason.')) return { icon: Brain, tone: eventTone(type) }
  if (type.includes('.llm.text.') || type.includes('.message.')) {
    return { icon: MessageSquareText, tone: eventTone(type) }
  }
  if (type.includes('.llm.')) return { icon: Bot, tone: eventTone(type) }
  if (type.includes('start') || type.includes('process')) {
    return { icon: LoaderCircle, tone: eventTone(type) }
  }
  if (type.includes('.step.')) return { icon: Play, tone: eventTone(type) }
  return { icon: FileClock, tone: eventTone(type) }
}

function toneClass(tone: Tone, target: 'text' | 'border' | 'badge') {
  const map = {
    default: {
      text: 'text-text-secondary',
      border: 'border-border',
      badge: 'bg-foreground/6 text-text-secondary',
    },
    primary: {
      text: 'text-primary',
      border: 'border-primary/30',
      badge: 'bg-primary/10 text-primary',
    },
    success: {
      text: 'text-success',
      border: 'border-success/30',
      badge: 'bg-success/10 text-success',
    },
    danger: {
      text: 'text-danger',
      border: 'border-danger/30',
      badge: 'bg-danger/10 text-danger',
    },
    warning: {
      text: 'text-yellow-500',
      border: 'border-yellow-500/30',
      badge: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    },
    muted: {
      text: 'text-text-info',
      border: 'border-border',
      badge: 'bg-foreground/5 text-text-info',
    },
  } satisfies Record<Tone, Record<'text' | 'border' | 'badge', string>>

  return map[tone][target]
}
