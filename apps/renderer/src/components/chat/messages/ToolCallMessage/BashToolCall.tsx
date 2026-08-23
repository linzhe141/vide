import type { ToolCall } from '@vide/ai'
import type { Workflow, ToolCallState } from '@/store/sessionStore/types'
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
import { useChatContext } from '@/hooks/useChatContext'
import { useSessionStoreActions } from '@/store/sessionStore'

type BashToolCallProps = {
  tool: ToolCall
  result?: ToolCallState['result']
  workflow: Workflow
}

function BashToolCall(props: BashToolCallProps) {
  const { tool, workflow, result } = props
  const { sessionId } = useChatContext()
  const { changeToolCallStatus } = useSessionStoreActions()
  const [open, setOpen] = useState(false)
  const isRunning =
    (tool.status === 'auto-approved' || tool.status === 'human-approved') && !props.result
  const isSuccess = props.result?.status === 'success'
  const isError = props.result?.status === 'error'
  const duration = formatDuration(props.result?.durationMs)

  const args = parseToolArguments(tool.function.arguments)
  const command =
    typeof args?.command === 'string' && args.command.trim()
      ? args.command
      : tool.function.arguments
  const bashResult = props.result?.result?.result as
    | {
        stdout?: string
        stderr?: string
        exitCode?: number
        timedOut?: boolean
        background?: boolean
      }
    | undefined

  const humanApproveToolCall = () => {
    changeToolCallStatus({
      sessionId,
      workflowId: workflow.id,
      toolCallId: tool.id,
      newStatus: 'human-approved',
    })
    window.ipcRendererApi.invoke('agent-human-approved', {
      sessionId,
      workflowId: workflow.id,
    })
  }

  const humanRejectToolCall = () => {
    changeToolCallStatus({
      sessionId,
      workflowId: workflow.id,
      toolCallId: tool.id,
      newStatus: 'human-rejected',
    })
    window.ipcRendererApi.invoke('agent-human-rejected', {
      sessionId,
      workflowId: workflow.id,
    })
  }

  return (
    <div className='space-y-2'>
      <div
        onClick={() => setOpen((value) => !value)}
        className='border-border/80 bg-background flex w-full flex-col gap-2 rounded-lg border px-4 py-3 text-left'
      >
        {/* 第一行：图标 + 命令 + 状态徽章/操作按钮 */}
        <div className='flex w-full items-center gap-3'>
          <div className='bg-foreground/6 text-foreground shrink-0 rounded-md p-2'>
            <SquareTerminal size={17} strokeWidth={1.8} />
          </div>
          <span className='text-foreground min-w-0 flex-1 truncate font-mono text-[14px] font-medium'>
            {command}
          </span>
          {isSuccess && <StatusBadge variant='success' label='Done' />}
          {isRunning && <StatusBadge variant='running' label='Running' />}
          {isError && <StatusBadge variant='error' label='Failed' />}
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
        </div>

        {/* 第二行：元信息 + Approval 区域 */}
        <div className='flex w-full items-center justify-between'>
          <div className='text-text-secondary flex items-center gap-2 text-xs'>
            <Code2 size={12} />
            <span>Bash command</span>
            {typeof bashResult?.exitCode === 'number' && <span>exit {bashResult.exitCode}</span>}
          </div>
          {(workflow.runtime.status === 'running' || workflow.runtime.status === 'interrupted') &&
            tool.status === 'waiting-human' && (
              <ApprovalActions onApprove={humanApproveToolCall} onReject={humanRejectToolCall} />
            )}
        </div>
      </div>

      {/* 详情区域 - 保留过渡动画 */}
      {open && (
        <div className='border-border/80 bg-background/80 rounded-lg border p-4 transition-all duration-200 ease-in-out'>
          <div className='space-y-4'>
            <section className='space-y-2'>
              <div className='text-text-secondary flex items-center gap-2 text-[12px] font-medium tracking-[0.16em] uppercase'>
                <Play size={13} />
                Command
              </div>
              <pre className='bg-foreground/4 text-foreground overflow-x-auto rounded-md p-3 font-mono text-xs leading-6'>
                {command}
              </pre>
            </section>

            {(bashResult?.stdout || bashResult?.stderr || result?.error !== undefined) && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  Output
                </div>
                {bashResult?.stdout && (
                  <pre className='bg-foreground/4 text-text-secondary overflow-auto overflow-x-auto rounded-md p-3 font-mono text-xs leading-6'>
                    {bashResult.stdout}
                  </pre>
                )}
                {bashResult?.stderr && (
                  <pre className='overflow-auto rounded-md bg-red-500/6 p-3 font-mono text-xs leading-6 text-red-500'>
                    {bashResult.stderr}
                  </pre>
                )}
                {result?.error !== undefined && (
                  <pre className='overflow-auto rounded-md bg-red-500/6 p-3 font-mono text-xs leading-6 text-red-500'>
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
    <div className='flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 dark:bg-yellow-950/50'>
      <span className='text-[12px] font-medium text-yellow-600 dark:text-yellow-300'>
        Waiting for Approval
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onApprove()
        }}
        className='rounded-full bg-emerald-500 p-1.5 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700'
        aria-label='Approve'
      >
        <Check size={14} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onReject()
        }}
        className='rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
        aria-label='Reject'
      >
        <XCircle size={14} />
      </button>
    </div>
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
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${className}`}>
      {label}
    </span>
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
