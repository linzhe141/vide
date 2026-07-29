import type { ToolCall } from '@vide/ai'
import type { ToolResultSessionMessage } from '@/store/sessionStore/types'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Ellipsis,
  FileEdit,
  FileSearch,
  Replace,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { CodeBlock } from '@/components/codeblock'

type SearchReplaceToolCallProps = {
  tool: ToolCall
  result?: ToolResultSessionMessage
}

export function SearchReplaceToolCall({ tool, result }: SearchReplaceToolCallProps) {
  const [open, setOpen] = useState(false)
  const isRunning = (tool.status === 'auto-approved' || tool.status === 'human-approved') && !result
  const isSuccess = result?.status === 'success'
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)

  const args = parseToolArguments(tool.function.arguments)
  const filePath = typeof args?.path === 'string' ? args.path : ''
  const oldText = typeof args?.oldText === 'string' ? args.oldText : ''
  const newText = typeof args?.newText === 'string' ? args.newText : ''

  const editResult = result?.result as
    | {
        success?: boolean
        path?: string
        size?: number
        message?: string
        diff?: string
        linesAdded?: number
        linesDeleted?: number
        replacements?: number
      }
    | undefined

  return (
    <div className='space-y-2'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='group border-border/80 from-foreground/[0.04] to-background hover:border-primary/25 dark:from-foreground/[0.06] dark:to-background/60 flex w-full items-center gap-3 rounded-[22px] border bg-gradient-to-br px-4 py-3 text-left shadow-[0_2px_18px_rgba(0,0,0,0.03)] transition dark:shadow-[0_6px_24px_rgba(0,0,0,0.22)]'
      >
        <div className='bg-foreground/6 text-foreground dark:bg-foreground/10 shrink-0 rounded-2xl p-2'>
          <FileSearch size={17} strokeWidth={1.8} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-3'>
            <span className='text-foreground truncate font-mono text-[14px] font-medium'>
              {filePath ? filePath.split('/').pop() : 'search-replace'}
            </span>
            {isSuccess && <StatusBadge variant='success' label='Done' />}
            {isRunning && <StatusBadge variant='running' label='Running' />}
            {isError && <StatusBadge variant='error' label='Failed' />}
          </div>
          <div className='text-text-secondary mt-1 flex items-center gap-2 text-xs'>
            <Replace size={12} />
            <span>Search & Replace</span>
            {editResult?.replacements !== undefined && (
              <span>{editResult.replacements} replacement(s)</span>
            )}
            {editResult?.linesAdded !== undefined && editResult?.linesDeleted !== undefined && (
              <span>
                +{editResult.linesAdded} -{editResult.linesDeleted}
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
        <div className='border-border/80 bg-background/80 rounded-[22px] border p-4'>
          <div className='space-y-4'>
            <section className='space-y-2'>
              <div className='text-text-secondary flex items-center gap-2 text-[12px] font-medium tracking-[0.16em] uppercase'>
                <FileEdit size={13} />
                File
              </div>
              <pre className='bg-foreground/[0.04] text-foreground overflow-x-auto rounded-2xl p-3 font-mono text-xs leading-6'>
                {filePath || 'N/A'}
              </pre>
            </section>

            <section className='space-y-2'>
              <div className='text-text-secondary flex items-center gap-2 text-[12px] font-medium tracking-[0.16em] uppercase'>
                <Replace size={13} />
                Search Pattern (Regex)
              </div>
              <pre className='bg-foreground/[0.04] text-foreground overflow-x-auto rounded-2xl p-3 font-mono text-xs leading-6'>
                {oldText || 'N/A'}
              </pre>
            </section>

            <section className='space-y-2'>
              <div className='text-text-secondary flex items-center gap-2 text-[12px] font-medium tracking-[0.16em] uppercase'>
                <Code2 size={13} />
                Replace With
              </div>
              <pre className='bg-foreground/[0.04] text-foreground overflow-x-auto rounded-2xl p-3 font-mono text-xs leading-6'>
                {newText || 'N/A'}
              </pre>
            </section>

            {editResult?.diff && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  Diff
                </div>
                <pre className='bg-foreground/[0.04] text-text-secondary overflow-x-auto rounded-2xl p-3 font-mono text-xs leading-6'>
                  {editResult.diff}
                </pre>
              </section>
            )}

            {editResult?.message && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  Result
                </div>
                <div className='rounded-2xl bg-emerald-500/[0.06] p-3 text-sm text-emerald-600 dark:text-emerald-300'>
                  {editResult.message}
                </div>
              </section>
            )}

            {result?.error !== undefined && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  Error
                </div>
                <pre className='overflow-auto rounded-2xl bg-red-500/[0.06] p-3 font-mono text-xs leading-6 text-red-500'>
                  {typeof result.error === 'string'
                    ? result.error
                    : JSON.stringify(result.error, null, 2)}
                </pre>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type EditFileToolCallProps = {
  tool: ToolCall
  result?: ToolResultSessionMessage
}

export function EditFileToolCall({ tool, result }: EditFileToolCallProps) {
  const [open, setOpen] = useState(false)
  const isRunning = (tool.status === 'auto-approved' || tool.status === 'human-approved') && !result
  const isSuccess = result?.status === 'success'
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)

  const args = parseToolArguments(tool.function.arguments)
  const filePath = typeof args?.path === 'string' ? args.path : ''
  const edits = Array.isArray(args?.edits) ? args.edits : []

  const editResult = result?.result as
    | {
        success?: boolean
        path?: string
        size?: number
        message?: string
        diff?: string
        linesAdded?: number
        linesDeleted?: number
        replacements?: number
      }
    | undefined

  return (
    <div className='space-y-2'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='group border-border/80 from-foreground/[0.04] to-background hover:border-primary/25 dark:from-foreground/[0.06] dark:to-background/60 flex w-full items-center gap-3 rounded-[22px] border bg-gradient-to-br px-4 py-3 text-left shadow-[0_2px_18px_rgba(0,0,0,0.03)] transition dark:shadow-[0_6px_24px_rgba(0,0,0,0.22)]'
      >
        <div className='bg-foreground/6 text-foreground dark:bg-foreground/10 shrink-0 rounded-2xl p-2'>
          <FileEdit size={17} strokeWidth={1.8} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-3'>
            <span className='text-foreground truncate font-mono text-[14px] font-medium'>
              {filePath ? filePath.split('/').pop() : 'edit-file'}
            </span>
            {isSuccess && <StatusBadge variant='success' label='Done' />}
            {isRunning && <StatusBadge variant='running' label='Running' />}
            {isError && <StatusBadge variant='error' label='Failed' />}
          </div>
          <div className='text-text-secondary mt-1 flex items-center gap-2 text-xs'>
            <Code2 size={12} />
            <span>{edits.length} edit(s)</span>
            {editResult?.replacements !== undefined && (
              <span>{editResult.replacements} replacement(s)</span>
            )}
            {editResult?.linesAdded !== undefined && editResult?.linesDeleted !== undefined && (
              <span>
                +{editResult.linesAdded} -{editResult.linesDeleted}
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
        <div className='border-border/80 bg-background/80 rounded-[22px] border p-4'>
          <div className='space-y-4'>
            <section className='space-y-2'>
              <div className='text-text-secondary flex items-center gap-2 text-[12px] font-medium tracking-[0.16em] uppercase'>
                <FileEdit size={13} />
                File
              </div>
              <pre className='bg-foreground/[0.04] text-foreground overflow-x-auto rounded-2xl p-3 font-mono text-xs leading-6'>
                {filePath || 'N/A'}
              </pre>
            </section>

            <section className='space-y-2'>
              <div className='text-text-secondary flex items-center gap-2 text-[12px] font-medium tracking-[0.16em] uppercase'>
                <Code2 size={13} />
                Edits ({edits.length})
              </div>
              <div className='space-y-2'>
                {edits.map((edit: { oldText: string; newText: string }, index: number) => (
                  <div key={index} className='bg-foreground/[0.04] space-y-1.5 rounded-2xl p-3'>
                    <div className='flex items-center gap-2 text-xs'>
                      <span className='text-text-secondary font-medium'>#{index + 1}</span>
                      <span className='text-text-secondary'>Search:</span>
                      <span className='text-foreground font-mono'>{edit.oldText || '(empty)'}</span>
                    </div>
                    <div className='flex items-center gap-2 text-xs'>
                      <span className='text-text-secondary'>Replace:</span>
                      <span className='font-mono text-emerald-600 dark:text-emerald-300'>
                        {edit.newText || '(empty)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {editResult?.diff && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  Diff
                </div>
                <pre className='bg-foreground/[0.04] text-text-secondary overflow-x-auto rounded-2xl p-3 font-mono text-xs leading-6'>
                  {editResult.diff}
                </pre>
                <CodeBlock lang='diff' code={editResult.diff} />
              </section>
            )}

            {editResult?.message && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  Result
                </div>
                <div className='rounded-2xl bg-emerald-500/[0.06] p-3 text-sm text-emerald-600 dark:text-emerald-300'>
                  {editResult.message}
                </div>
              </section>
            )}

            {result?.error !== undefined && (
              <section className='space-y-2'>
                <div className='text-text-secondary text-[12px] font-medium tracking-[0.16em] uppercase'>
                  Error
                </div>
                <pre className='overflow-auto rounded-2xl bg-red-500/[0.06] p-3 font-mono text-xs leading-6 text-red-500'>
                  {typeof result.error === 'string'
                    ? result.error
                    : JSON.stringify(result.error, null, 2)}
                </pre>
              </section>
            )}
          </div>
        </div>
      )}
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
