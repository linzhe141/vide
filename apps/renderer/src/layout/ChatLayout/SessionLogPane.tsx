import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Circle,
  FileClock,
  MessageSquareText,
  PencilLine,
  TerminalSquare,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/components/chat/ChatProvider'
import { useSessionWorkflows } from '@/store/sessionStore'
import type { SessionMessage, Workflow, WorkflowLogEvent } from '@/store/sessionStore/types'
import { useChatLayout } from '.'

type LogEntry = {
  id: string
  type: string
  createdAt?: number
  title: string
  description?: string
  payload?: unknown
  tone: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'muted'
}

export function SessionLogPane({ className }: { className?: string }) {
  const { closePane } = useChatLayout()
  const { sessionId } = useChatContext()
  const workflows = useSessionWorkflows(sessionId) ?? []
  const totalEvents = workflows.reduce(
    (sum, workflow) => sum + getWorkflowEntries(workflow).length,
    0
  )
  const toolEvents = workflows.reduce(
    (sum, workflow) =>
      sum + getWorkflowEntries(workflow).filter((entry) => entry.type.includes('tool')).length,
    0
  )
  const errorEvents = workflows.reduce(
    (sum, workflow) =>
      sum +
      getWorkflowEntries(workflow).filter(
        (entry) => entry.tone === 'danger' || entry.type.includes('error')
      ).length,
    0
  )

  return (
    <div className={cn('bg-background flex h-full flex-col', className)}>
      <div className='border-border flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-primary/8 text-primary border-primary/10 rounded-lg border p-1.5'>
          <FileClock size={15} strokeWidth={1.9} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-foreground truncate text-sm font-medium'>Session log</div>
          <div className='text-text-secondary truncate text-xs'>
            {workflows.length} workflows · {totalEvents} events · {toolEvents} tool events
          </div>
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
        <div className='mb-4 grid grid-cols-3 gap-2'>
          <SummaryCard label='Workflows' value={workflows.length} />
          <SummaryCard label='Events' value={totalEvents} />
          <SummaryCard label='Errors' value={errorEvents} danger={errorEvents > 0} />
        </div>

        {workflows.length === 0 ? (
          <div className='border-border text-text-secondary rounded-xl border p-4 text-sm'>
            No workflow logs yet.
          </div>
        ) : (
          <div className='space-y-4'>
            {workflows.map((workflow, index) => (
              <WorkflowLogSection
                key={workflow.id}
                index={index}
                workflow={workflow}
                entries={getWorkflowEntries(workflow)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  danger = false,
}: {
  label: string
  value: number
  danger?: boolean
}) {
  return (
    <div
      className={cn(
        'border-border bg-foreground/[0.025] rounded-xl border px-3 py-2',
        danger && 'border-danger/25 bg-danger/8'
      )}
    >
      <div
        className={cn(
          'text-lg leading-6 font-semibold',
          danger ? 'text-danger' : 'text-foreground'
        )}
      >
        {value}
      </div>
      <div className='text-text-secondary text-[11px]'>{label}</div>
    </div>
  )
}

function WorkflowLogSection({
  index,
  workflow,
  entries,
}: {
  index: number
  workflow: Workflow
  entries: LogEntry[]
}) {
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
        <div className='before:bg-border relative space-y-2 before:absolute before:top-3 before:bottom-3 before:left-[17px] before:w-px'>
          {entries.map((entry) => (
            <LogRow key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </section>
  )
}

function LogRow({ entry }: { entry: LogEntry }) {
  return (
    <div className='relative flex gap-3'>
      <div
        className={cn(
          'bg-background z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border',
          toneClass(entry.tone, 'border')
        )}
      >
        <EventIcon type={entry.type} tone={entry.tone} />
      </div>

      <div className='border-border/60 bg-background/75 min-w-0 flex-1 rounded-xl border px-3 py-2.5'>
        <div className='flex min-w-0 items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                  toneClass(entry.tone, 'badge')
                )}
              >
                {eventLabel(entry.type)}
              </span>
              <span className='text-foreground truncate text-sm font-medium'>{entry.title}</span>
            </div>
            {entry.description && (
              <div className='text-text-secondary mt-1 line-clamp-2 text-xs leading-5'>
                {entry.description}
              </div>
            )}
          </div>
          {entry.createdAt && (
            <span className='text-text-info shrink-0 font-mono text-[10px]'>
              {formatTime(entry.createdAt)}
            </span>
          )}
        </div>

        {entry.payload !== undefined && (
          <pre className='bg-foreground/[0.035] text-text-secondary mt-2 max-h-32 overflow-auto rounded-lg p-2 font-mono text-[11px] leading-5'>
            {stringifyPayload(entry.payload)}
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

function EventIcon({ type, tone }: { type: string; tone: LogEntry['tone'] }) {
  const className = cn('size-3.5', toneClass(tone, 'text'))
  if (type.includes('error')) return <AlertCircle className={className} />
  if (type.includes('completed') || type.includes('success'))
    return <CheckCircle2 className={className} />
  if (type.includes('aborted')) return <XCircle className={className} />
  if (type.includes('tool')) return <TerminalSquare className={className} />
  if (type.includes('llm')) return <Bot className={className} />
  if (type.includes('text') || type.includes('reason')) return <PencilLine className={className} />
  if (type.includes('start')) return <Zap className={className} />
  return <Circle className={className} />
}

function getWorkflowEntries(workflow: Workflow): LogEntry[] {
  if (workflow.events?.length) {
    return workflow.events.map((event) => logEntryFromEvent(event))
  }
  return deriveEntriesFromMessages(workflow)
}

function logEntryFromEvent(event: WorkflowLogEvent): LogEntry {
  const payload = event.payload as Record<string, unknown> | undefined
  const toolCall = payload?.toolCall as { toolName?: string; args?: unknown } | undefined
  const toolCallResult = payload?.toolCallResult as
    | { toolName?: string; durationMs?: number; result?: unknown; error?: unknown }
    | undefined

  if (event.type === 'workflow.start') {
    return createEntry(event, 'Workflow started', getText(payload?.input), 'primary')
  }
  if (event.type === 'workflow.completed') {
    return createEntry(event, 'Workflow completed', getText(payload?.result), 'success')
  }
  if (event.type === 'workflow.aborted') {
    return createEntry(event, 'Workflow aborted', undefined, 'danger')
  }
  if (event.type === 'workflow.interrupted') {
    return createEntry(
      event,
      'Workflow interrupted',
      'Waiting for user approval or input.',
      'warning'
    )
  }
  if (event.type.includes('error')) {
    return createEntry(event, 'Error', getText(payload?.error), 'danger', payload?.error)
  }
  if (event.type === 'workflow.tool.call.start') {
    return createEntry(
      event,
      `Tool started: ${toolCall?.toolName ?? 'unknown'}`,
      undefined,
      'primary',
      toolCall?.args
    )
  }
  if (event.type === 'workflow.tool.call.success') {
    return createEntry(
      event,
      `Tool succeeded: ${toolCallResult?.toolName ?? 'unknown'}`,
      toolCallResult?.durationMs != null ? `${toolCallResult.durationMs}ms` : undefined,
      'success',
      toolCallResult?.result
    )
  }
  if (event.type === 'workflow.tool.call.error') {
    return createEntry(
      event,
      `Tool failed: ${toolCallResult?.toolName ?? 'unknown'}`,
      undefined,
      'danger',
      toolCallResult?.error
    )
  }
  if (event.type === 'workflow.llm.tool.call.end') {
    const toolCalls = Array.isArray(payload?.toolCall) ? payload.toolCall.length : 0
    return createEntry(
      event,
      'Tool calls requested',
      `${toolCalls} calls`,
      'primary',
      payload?.toolCall
    )
  }
  if (event.type.includes('llm')) {
    return createEntry(event, llmTitle(event.type), getContentSummary(payload), 'muted')
  }
  if (event.type.includes('step')) {
    return createEntry(
      event,
      event.type.endsWith('start') ? 'Step started' : 'Step finished',
      undefined,
      'default',
      payload
    )
  }
  return createEntry(event, event.type, undefined, 'default', payload)
}

function createEntry(
  event: WorkflowLogEvent,
  title: string,
  description: string | undefined,
  tone: LogEntry['tone'],
  payload?: unknown
): LogEntry {
  return {
    id: event.id,
    type: event.type,
    createdAt: event.createdAt,
    title,
    description,
    tone,
    payload,
  }
}

function deriveEntriesFromMessages(workflow: Workflow): LogEntry[] {
  const entries: LogEntry[] = [
    {
      id: `${workflow.id}:start`,
      type: 'workflow.start',
      title: 'Workflow started',
      description: workflow.input,
      tone: 'primary',
    },
  ]

  workflow.messages.forEach((message, index) => {
    const entry = logEntryFromMessage(message, index)
    if (entry) entries.push(entry)
  })

  entries.push({
    id: `${workflow.id}:status`,
    type: `workflow.${workflow.runtime.status}`,
    title: `Workflow ${workflow.runtime.status}`,
    tone:
      workflow.runtime.status === 'finished'
        ? 'success'
        : workflow.runtime.status === 'running'
          ? 'primary'
          : 'danger',
  })

  return entries
}

function logEntryFromMessage(message: SessionMessage, index: number): LogEntry | null {
  if (message.role === 'user') {
    return {
      id: message.id,
      type: 'message.user',
      title: 'User input',
      description: message.content,
      tone: 'primary',
    }
  }
  if (message.role === 'assistant-reason') {
    return {
      id: message.id,
      type: 'workflow.llm.reason',
      title: message.reasoning ? 'Reasoning' : 'Reasoning completed',
      description: message.content,
      tone: 'muted',
    }
  }
  if (message.role === 'assistant-text') {
    return {
      id: message.id,
      type: 'workflow.llm.text',
      title: message.streaming ? 'Assistant response streaming' : 'Assistant response',
      description: message.content,
      tone: 'muted',
    }
  }
  if (message.role === 'tool-call') {
    return {
      id: message.id,
      type: 'workflow.tool.call',
      title: 'Tool calls',
      description: `${message.toolCalls.length} calls`,
      tone: message.toolCalls.some((item) => item.result?.status === 'error')
        ? 'danger'
        : 'primary',
      payload: message.toolCalls.map((item) => ({
        name: item.toolCall.function.name,
        status: item.result?.status ?? 'pending',
        durationMs: item.result?.durationMs,
      })),
    }
  }
  if (message.role === 'ask-user-question') {
    return {
      id: message.id,
      type: 'workflow.interrupted',
      title: message.answer ? 'User answered question' : 'Waiting for user answer',
      description: message.title,
      tone: message.answer ? 'success' : 'warning',
      payload: message.answer,
    }
  }
  if (message.role === 'error') {
    return {
      id: message.id,
      type: 'workflow.error',
      title: 'Error',
      description: getText(message.error),
      tone: 'danger',
      payload: message.error,
    }
  }
  if (message.role === 'workflow') {
    return {
      id: `${message.id ?? index}:subworkflow`,
      type: 'workflow.sub',
      title: 'Sub workflow',
      description: message.input,
      tone: 'default',
    }
  }
  return null
}

function llmTitle(type: string) {
  if (type.includes('reason'))
    return type.endsWith('start')
      ? 'Reasoning started'
      : type.endsWith('end')
        ? 'Reasoning completed'
        : 'Reasoning delta'
  if (type.includes('text'))
    return type.endsWith('start')
      ? 'Text started'
      : type.endsWith('end')
        ? 'Text completed'
        : 'Text delta'
  if (type.endsWith('start')) return 'LLM started'
  if (type.endsWith('end')) return 'LLM completed'
  if (type.endsWith('result')) return 'LLM result'
  return 'LLM event'
}

function getContentSummary(payload: Record<string, unknown> | undefined) {
  const content = getText(payload?.content)
  if (content) return content
  const delta = (payload?.chunk as { delta?: unknown } | undefined)?.delta
  return getText(delta)
}

function getText(value: unknown) {
  if (typeof value === 'string') return value
  if (value == null) return undefined
  if (value instanceof Error) return value.message
  return stringifyPayload(value)
}

function stringifyPayload(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
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

function toneClass(tone: LogEntry['tone'], target: 'text' | 'border' | 'badge') {
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
  } satisfies Record<LogEntry['tone'], Record<'text' | 'border' | 'badge', string>>

  return map[tone][target]
}
