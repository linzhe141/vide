import type { Workflow, ToolCallSessionMessage, ToolCallState } from '@/store/sessionStore/types'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Ellipsis,
  SquareTerminal,
  XCircle,
} from 'lucide-react'
import type { ToolCall } from '@vide/ai'
import { useState } from 'react'
import ImageToolCall from './ImageToolCall'
import BashToolCall from './BashToolCall'
import WebSearchToolCall from './WebSearchToolCall'
import { EditFileToolCall, SearchReplaceToolCall } from './EditFileToolCall'
import { ReadFileToolCall, WriteFileToolCall } from './FileToolCall'
import { SubAgentToolCall } from './SubAgentToolCall'
import TodoToolCall from './TodoToolCall'

type ToolCallViewProps = {
  workflow: Workflow
  message: ToolCallSessionMessage
}

export function ToolCallMessage({ workflow, message }: ToolCallViewProps) {
  const visibleTools = message.toolCalls.filter((item) => shouldShowToolCall(item.toolCall))
  if (!visibleTools.length) return null
  return (
    <div className='space-y-3'>
      {visibleTools.map((state) => {
        const tool = state.toolCall
        if (tool.function.name === 'generate-image') {
          return <ImageToolCall key={tool.id} tool={tool} result={state.result} />
        }

        if (tool.function.name === 'execute-bash-command') {
          return (
            <BashToolCall key={tool.id} tool={tool} result={state.result} workflow={workflow} />
          )
        }

        if (tool.function.name === 'websearch') {
          return <WebSearchToolCall key={tool.id} tool={tool} result={state.result} />
        }

        if (tool.function.name === 'search-replace') {
          return <SearchReplaceToolCall key={tool.id} tool={tool} result={state.result} />
        }

        if (tool.function.name === 'read-file') {
          return <ReadFileToolCall key={tool.id} tool={tool} result={state.result} />
        }

        if (tool.function.name === 'write-file' || tool.function.name === 'append-file') {
          return <WriteFileToolCall key={tool.id} tool={tool} result={state.result} />
        }

        if (tool.function.name === 'call-sub-agent') {
          return <SubAgentToolCall key={tool.id} workflow={workflow} toolCallState={state} />
        }

        if (tool.function.name === 'edit-file') {
          return <EditFileToolCall key={tool.id} tool={tool} result={state.result} />
        }

        if (tool.function.name === 'todo_write') {
          return <TodoToolCall key={tool.id} tool={tool} result={state.result} />
        }

        return <ToolCallButton key={tool.id} tool={tool} result={state.result} />
      })}
    </div>
  )
}

const HIDDEN_TOOL_NAMES = new Set<string>([
  'ask-user-question-generate',
  // 'submit-plan',
  // 'update-plan-step',
])

function shouldShowToolCall(tool: ToolCall) {
  return !HIDDEN_TOOL_NAMES.has(tool.function.name)
}

type ToolCallButtonProps = {
  tool: ToolCall
  result?: ToolCallState['result']
}
function ToolCallButton({ tool, result }: ToolCallButtonProps) {
  const [open, setOpen] = useState(false)
  const isRunning = !result
  const isSuccess = result?.status === 'success'
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)

  return (
    <div className='space-y-1.5'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='border-border bg-background/80 hover:bg-foreground/3 dark:bg-background/60 dark:hover:bg-foreground/5 flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all duration-200'
      >
        <div className='text-text-secondary shrink-0'>
          <SquareTerminal size={15} strokeWidth={1.8} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='text-foreground truncate text-[11px] leading-none font-medium'>
              {tool.function.name}
            </span>
            {isSuccess && (
              <span className='bg-success/10 text-success rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium'>
                Success
              </span>
            )}
            {isRunning && (
              <span className='bg-foreground/5 text-text-secondary rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium'>
                Running
              </span>
            )}
            {isError && (
              <span className='bg-danger/10 text-danger rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium'>
                Error
              </span>
            )}
          </div>
        </div>
        <div className='text-text-secondary flex items-center gap-2 text-[11px]'>
          {duration && (
            <span className='flex items-center gap-1'>
              <Clock3 size={12} />
              {duration}
            </span>
          )}
          {isRunning && <Ellipsis size={14} className='animate-pulse' />}
          {isSuccess && <CheckCircle2 size={14} className='text-success' />}
          {isError && <XCircle size={14} className='text-danger' />}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {open && (
        <div className='border-border bg-foreground/3 dark:bg-foreground/4 rounded-xl border p-3'>
          <div className='space-y-3'>
            <section className='space-y-1.5'>
              <div className='text-text-info text-[10px] font-medium tracking-[0.12em] uppercase'>
                Arguments
              </div>
              <pre className='bg-background text-text-secondary overflow-x-auto rounded-lg p-2.5 text-[11px] leading-relaxed'>
                {JSON.stringify(JSON.parse(tool.function.arguments), null, 2)}
              </pre>
            </section>

            {(result?.result !== undefined || result?.error !== undefined) && (
              <section className='space-y-1.5'>
                <div className='text-text-info text-[10px] font-medium tracking-[0.12em] uppercase'>
                  {result?.error !== undefined ? 'Error' : 'Result'}
                </div>
                <pre className='bg-background text-text-secondary overflow-x-auto rounded-lg p-2.5 text-[11px] leading-relaxed'>
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
