import { ASK_USER_TOOL_NAMES } from '@/agent/core/tools/askUserQuestion'
import type {
  Workflow,
  ToolCallSessionMessage,
  ToolResultSessionMessage,
} from '@/app/src/store/sessionStore/types'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Ellipsis,
  SquareTerminal,
  XCircle,
} from 'lucide-react'
import type { ToolCall } from '@/agent/core/types'
import { useState } from 'react'
import { Image_TOOL_NAMES } from '@/agent/core/tools/image'
import ImageToolCall from '../ImageToolCall'
import { useChatContext } from '../ChatProvider'

type ToolCallViewProps = {
  workflow: Workflow
  message: ToolCallSessionMessage
}

export function ToolCallMessage({ workflow, message }: ToolCallViewProps) {
  const visibleTools = message.toolCalls.filter(
    (tool) => tool.function.name !== ASK_USER_TOOL_NAMES.GENERATE
  )

  if (!visibleTools.length) return null

  return (
    <div className='space-y-3'>
      {visibleTools.map((tool) => {
        if (tool.function.name === Image_TOOL_NAMES.GENERATE_IMAGE) {
          return <ImageToolCall key={tool.id} workflow={workflow} toolCall={tool} />
        }
        return (
          <ToolCallButton
            key={tool.id}
            tool={tool}
            result={findToolResult(workflow, tool.id)}
            waitHumanApprove={workflow.runtime.waitingHuman}
            originToolCalls={message.toolCalls}
            workflow={workflow}
          />
        )
      })}
      {/* <div className='text-primary flex items-center gap-2 pt-1 text-[15px] font-medium'>
        <Wrench size={15} />
        <span>{visibleTools.length} tools</span>
      </div> */}
    </div>
  )
}

type ToolCallButtonProps = {
  tool: ToolCall
  result?: ToolResultSessionMessage
  originToolCalls: ToolCall[]
  waitHumanApprove: boolean
  workflow: Workflow
}
function ToolCallButton({
  tool,
  result,
  waitHumanApprove,
  workflow,
  originToolCalls,
}: ToolCallButtonProps) {
  const { sessionId } = useChatContext()
  const [open, setOpen] = useState(false)
  const isBashTool = tool.function.name === 'execute-bash-command'
  const isRunning = !waitHumanApprove && !result
  const isSuccess = result?.status === 'success'
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)

  const humanApproveToolCall = () => {
    const originIndex = originToolCalls.findIndex((t) => t.id === tool.id)
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
        className='border-border bg-background/80 dark:bg-background/60 hover:bg-foreground/[0.03] dark:hover:bg-foreground/[0.05] flex w-full items-center gap-3 rounded-[22px] border px-4 py-3 text-left shadow-[0_2px_18px_rgba(0,0,0,0.03)] transition dark:shadow-[0_6px_24px_rgba(0,0,0,0.22)]'
      >
        <div className='text-text-secondary shrink-0'>
          <SquareTerminal size={17} strokeWidth={1.8} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-3'>
            <span className='text-foreground truncate text-[15px] font-medium'>
              {tool.function.name}
            </span>
            {waitHumanApprove && isBashTool && !result && (
              <span className='flex items-center gap-2 rounded-full bg-yellow-100 px-2 py-0.5 text-[12px] font-medium text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-300'>
                Waiting for Approval
                <Check
                  size={12}
                  className='ml-1 text-yellow-500 dark:text-yellow-300'
                  onClick={(e) => {
                    e.stopPropagation()
                    humanApproveToolCall()
                  }}
                />
                <XCircle
                  size={12}
                  className='ml-1 text-red-500 dark:text-red-300'
                  onClick={(e) => {
                    e.stopPropagation()
                    humanRejectToolCall()
                  }}
                />
              </span>
            )}
            {isSuccess && (
              <span className='rounded-full bg-emerald-100 px-2 py-0.5 text-[12px] font-medium text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'>
                Success
              </span>
            )}
            {isRunning && (
              <span className='bg-foreground/6 text-text-secondary dark:bg-foreground/10 rounded-full px-2 py-0.5 text-[12px] font-medium'>
                Running
              </span>
            )}
            {isError && (
              <span className='rounded-full bg-red-100 px-2 py-0.5 text-[12px] font-medium text-red-500 dark:bg-red-950/40 dark:text-red-300'>
                Error
              </span>
            )}
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
        <div className='border-border bg-foreground/[0.03] dark:bg-foreground/[0.04] rounded-[22px] border p-4'>
          <div className='space-y-4'>
            <section className='space-y-2'>
              <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                Arguments
              </div>
              <pre className='bg-background text-text-secondary overflow-x-auto rounded-2xl p-3 text-xs leading-6'>
                {tool.function.arguments}
              </pre>
            </section>

            {(result?.result !== undefined || result?.error !== undefined) && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  {result?.error !== undefined ? 'Error' : 'Result'}
                </div>
                <pre className='bg-background text-text-secondary overflow-x-auto rounded-2xl p-3 text-xs leading-6'>
                  {JSON.stringify(result?.error ?? result?.result, null, 2)}
                </pre>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(durationMs?: number) {
  if (!durationMs) return null
  if (durationMs < 1000) return `${durationMs}ms`

  const seconds = durationMs / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`

  return `${Math.round(seconds)}s`
}

export function findToolResult(
  workflow: Workflow,
  toolCallId: string
): ToolResultSessionMessage | undefined {
  return [...workflow.messages]
    .reverse()
    .find(
      (message): message is ToolResultSessionMessage =>
        message.role === 'tool-result' && message.toolCallId === toolCallId
    )
}
