import type { ToolCall } from '@vide/ai'
import type { Workflow, ToolResultSessionMessage } from '../../../../store/sessionStore/types'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Ellipsis,
  Play,
  SquareTerminal,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useChatContext } from '../../ChatProvider'
import { useSessionStoreActions } from '../../../../store/sessionStore'

type BashToolCallProps = {
  tool: ToolCall
  result?: ToolResultSessionMessage
  originToolCalls: ToolCall[]
  workflow: Workflow
}

function BashToolCall({ tool, result, workflow, originToolCalls }: BashToolCallProps) {
  const { sessionId } = useChatContext()
  const { changeToolCallStatus } = useSessionStoreActions()
  const [open, setOpen] = useState(false)
  const isRunning = (tool.status === 'auto-approved' || tool.status === 'human-approved') && !result
  const isSuccess = result?.status === 'success'
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)

  const args = parseToolArguments(tool.function.arguments)
  const command =
    typeof args?.command === 'string' && args.command.trim()
      ? args.command
      : tool.function.arguments
  const bashResult = result?.result as
    | {
        stdout?: string
        stderr?: string
        exitCode?: number
        timedOut?: boolean
        background?: boolean
      }
    | undefined

  const humanApproveToolCall = () => {
    const originIndex = originToolCalls.findIndex((t) => t.id === tool.id)
    changeToolCallStatus({
      sessionId,
      workflowId: workflow.id,
      toolCallId: tool.id,
      newStatus: 'human-approved',
    })
    window.ipcRendererApi.invoke('agent-human-approved', {
      sessionId,
      workflowId: workflow.id,
      payload: {
        index: originIndex,
        toolCalls: originToolCalls,
      },
    })
  }

  const humanRejectToolCall = () => {
    const originIndex = originToolCalls.findIndex((t) => t.id === tool.id)
    changeToolCallStatus({
      sessionId,
      workflowId: workflow.id,
      toolCallId: tool.id,
      newStatus: 'human-rejected',
    })
    window.ipcRendererApi.invoke('agent-human-rejected', {
      sessionId,
      workflowId: workflow.id,
      payload: {
        index: originIndex,
        toolCalls: originToolCalls,
      },
    })
  }

  return (
    <div className='space-y-2'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='group border-border/80 from-foreground/[0.04] to-background hover:border-primary/25 dark:from-foreground/[0.06] dark:to-background/60 flex w-full items-center gap-3 rounded-[22px] border bg-gradient-to-br px-4 py-3 text-left shadow-[0_2px_18px_rgba(0,0,0,0.03)] transition dark:shadow-[0_6px_24px_rgba(0,0,0,0.22)]'
      >
        <div className='bg-foreground/6 text-foreground dark:bg-foreground/10 shrink-0 rounded-2xl p-2'>
          <SquareTerminal size={17} strokeWidth={1.8} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-3'>
            <span className='text-foreground truncate font-mono text-[14px] font-medium'>
              {command}
            </span>
            {tool.status === 'waiting-human' && (
              <ApprovalActions onApprove={humanApproveToolCall} onReject={humanRejectToolCall} />
            )}
            {isSuccess && <StatusBadge variant='success' label='Done' />}
            {isRunning && <StatusBadge variant='running' label='Running' />}
            {isError && <StatusBadge variant='error' label='Failed' />}
          </div>
          <div className='text-text-secondary mt-1 flex items-center gap-2 text-xs'>
            <Code2 size={12} />
            <span>Bash command</span>
            {typeof bashResult?.exitCode === 'number' && <span>exit {bashResult.exitCode}</span>}
          </div>
        </div>
        <div className='text-text-secondary flex items-center gap-3 text-[13px]'>
          {duration && (
            <span className='flex items-center gap-1.5'>
              <Clock3 size={14} />
              {duration}
            </span>
          )}
          {isRunning && <Ellipsis size={16} className='animate-pulse' />}
          {isSuccess && (
            <CheckCircle2 size={16} className='text-emerald-500 dark:text-emerald-300' />
          )}
          {isError && <XCircle size={16} className='text-red-500 dark:text-red-300' />}
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {open && (
        <div className='border-border/80 bg-background/80 rounded-[22px] border p-4'>
          <div className='space-y-4'>
            <section className='space-y-2'>
              <div className='text-text-secondary flex items-center gap-2 text-[12px] font-medium tracking-[0.16em] uppercase'>
                <Play size={13} />
                Command
              </div>
              <pre className='bg-foreground/[0.04] text-foreground overflow-x-auto rounded-2xl p-3 font-mono text-xs leading-6'>
                {command}
              </pre>
            </section>

            {(bashResult?.stdout || bashResult?.stderr || result?.error !== undefined) && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  Output
                </div>
                {bashResult?.stdout && (
                  <pre className='bg-foreground/[0.04] text-text-secondary overflow-x-auto rounded-2xl p-3 font-mono text-xs leading-6'>
                    {bashResult.stdout}
                  </pre>
                )}
                {bashResult?.stderr && (
                  <pre className='rounded-2xl bg-red-500/[0.06] p-3 font-mono text-xs leading-6 text-red-500'>
                    {bashResult.stderr}
                  </pre>
                )}
                {result?.error !== undefined && (
                  <pre className='rounded-2xl bg-red-500/[0.06] p-3 font-mono text-xs leading-6 text-red-500'>
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ApprovalActions({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  return (
    <span className='flex items-center gap-2 rounded-full bg-yellow-100 px-2 py-0.5 text-[12px] font-medium text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-300'>
      Waiting for Approval
      <Check
        size={12}
        className='ml-1 text-yellow-500 dark:text-yellow-300'
        onClick={(e) => {
          e.stopPropagation()
          onApprove()
        }}
      />
      <XCircle
        size={12}
        className='ml-1 text-red-500 dark:text-red-300'
        onClick={(e) => {
          e.stopPropagation()
          onReject()
        }}
      />
    </span>
  )
}

function StatusBadge({
  variant,
  label,
}: {
  variant: 'success' | 'running' | 'error'
  label: string
}) {
  const className =
    variant === 'success'
      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'
      : variant === 'running'
        ? 'bg-foreground/6 text-text-secondary dark:bg-foreground/10'
        : 'bg-red-100 text-red-500 dark:bg-red-950/40 dark:text-red-300'

  return (
    <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${className}`}>{label}</span>
  )
}

function parseToolArguments(argumentsText: string) {
  try {
    return JSON.parse(argumentsText) as Record<string, unknown>
  } catch {
    return null
  }
}

function formatDuration(durationMs?: number) {
  if (!durationMs) return null
  if (durationMs < 1000) return `${durationMs}ms`

  const seconds = durationMs / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`

  return `${Math.round(seconds)}s`
}

export default BashToolCall
