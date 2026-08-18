import { FileClock, MessageSquareText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/components/chat/ChatProvider'
import { useSessionWorkflows } from '@/store/sessionStore'
import type { Workflow, WorkflowLogEvent } from '@/store/sessionStore/types'
import { useChatLayout } from '.'

export function SessionLogPane({ className }: { className?: string }) {
  const { closePane } = useChatLayout()
  const { sessionId } = useChatContext()
  const workflows = useSessionWorkflows(sessionId) ?? []

  return (
    <div className={cn('bg-background flex h-full flex-col', className)}>
      <div className='border-border flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-primary/8 text-primary border-primary/10 rounded-lg border p-1.5'>
          <FileClock size={15} strokeWidth={1.9} />
        </div>
        <div className='text-foreground min-w-0 flex-1 truncate text-sm font-medium'>
          Session log
        </div>
        <button
          type='button'
          className='text-text-secondary hover:text-foreground rounded p-1 transition'
          onClick={() => closePane?.()}
          title='Close pane'
          aria-label='Close pane'
        >
          <X size={16} />
        </button>
      </div>

      <div className='h-0 flex-1 overflow-auto px-4 py-4'>
        {workflows.length === 0 ? (
          <div className='border-border text-text-secondary rounded-xl border p-4 text-sm'>
            No workflow logs yet.
          </div>
        ) : (
          <div className='space-y-4'>
            {workflows.map((workflow, index) => (
              <WorkflowLogSection key={workflow.id} index={index} workflow={workflow} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WorkflowLogSection({ index, workflow }: { index: number; workflow: Workflow }) {
  debugger
  return (
    <section className='border-border/80 bg-foreground/[0.018] overflow-hidden rounded-2xl border'>
      <div className='border-border/70 bg-background/70 flex items-start gap-3 border-b px-4 py-3'>
        <div className='bg-primary/10 text-primary mt-0.5 rounded-lg p-1.5'>
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
        </div>
        <span className='text-text-info font-mono text-[11px]'>{shortId(workflow.id)}</span>
      </div>

      <div className='px-3 py-3'>
        <div className='relative space-y-2 before:absolute before:top-3 before:bottom-3 before:left-[17px] before:w-px'>
          {(workflow.events ?? []).map((event) => {
            // 不需要展示的事件（如流式 delta）在 map 里直接跳过
            if (!shouldLog(event.type)) return null
            return <LogRow key={event.id} event={event} />
          })}
        </div>
      </div>
    </section>
  )
}

/** 只展示有意义的完整事件；reason/text 的流式 delta 仅用于拼接内容，不单独展示。 */
function shouldLog(type: string) {
  return type !== 'workflow.llm.reason.delta' && type !== 'workflow.llm.text.delta'
}

function LogRow({ event }: { event: WorkflowLogEvent }) {
  return (
    <div className='border-border/60 bg-background/75 min-w-0 rounded-xl border px-3 py-2.5'>
      <div className='flex min-w-0 items-start justify-between gap-3'>
        <span className='text-foreground truncate font-mono text-xs'>{eventLabel(event.type)}</span>
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

function stringifyPayload(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

type Tone = 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'muted'

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
