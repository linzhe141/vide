import type { ToolCall } from '@vide/ai'
import type { ToolResultSessionMessage } from '../../../../store/sessionStore/types'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Ellipsis,
  ExternalLink,
  Search,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'

type WebSearchToolCallProps = {
  tool: ToolCall
  result?: ToolResultSessionMessage
}

type WebSearchResult = {
  query?: string
  didYouMean?: string
  results?: Array<{
    title?: string
    link?: string
    snippet?: string
    date?: string
    position?: number
  }>
  credits?: number
}

function WebSearchToolCall({ tool, result }: WebSearchToolCallProps) {
  const [open, setOpen] = useState(true)
  const args = parseToolArguments(tool.function.arguments)
  const query = typeof args?.query === 'string' ? args.query : tool.function.arguments
  const searchResult = result?.result as WebSearchResult | undefined
  const results = searchResult?.results ?? []
  const isRunning = !result
  const isSuccess = result?.status === 'success'
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)

  return (
    <div className='space-y-2'>
      <button
        onClick={() => setOpen((value) => !value)}
        className='group border-border/80 from-primary/8 to-background hover:border-primary/30 dark:from-primary/12 dark:to-background/70 flex w-full items-center gap-3 rounded-[22px] border bg-linear-to-br px-4 py-3 text-left shadow-[0_2px_18px_rgba(0,0,0,0.03)] transition dark:shadow-[0_6px_24px_rgba(0,0,0,0.22)]'
      >
        <div className='bg-primary/10 text-primary shrink-0 rounded-2xl p-2'>
          <Search size={17} strokeWidth={1.8} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-3'>
            <span className='text-foreground truncate text-[15px] font-medium'>{query}</span>
            {isSuccess && <StatusBadge variant='success' label={`${results.length} results`} />}
            {isRunning && <StatusBadge variant='running' label='Searching' />}
            {isError && <StatusBadge variant='error' label='Failed' />}
          </div>
          <div className='text-text-secondary mt-1 flex items-center gap-2 text-xs'>
            <span>Web search</span>
            {searchResult?.didYouMean && <span>Did you mean: {searchResult.didYouMean}</span>}
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
        <div className='border-border/80 bg-background/85 rounded-[22px] border p-4'>
          {isRunning && (
            <div className='text-text-secondary flex items-center gap-2 text-sm'>
              <Ellipsis size={16} className='animate-pulse' />
              Searching the web...
            </div>
          )}

          {isError && (
            <pre className='rounded-2xl bg-red-500/6 p-3 font-mono text-xs leading-6 text-red-500'>
              {JSON.stringify(result?.error, null, 2)}
            </pre>
          )}

          {isSuccess && (
            <div className='space-y-4'>
              <div className='grid gap-2'>
                {results.map((item, index) => (
                  <a
                    key={`${item.link}-${index}`}
                    href={item.link}
                    target='_blank'
                    rel='noreferrer'
                    className='border-border/70 bg-foreground/2.5 hover:border-primary/25 hover:bg-primary/4 block overflow-hidden rounded-2xl border p-3 text-ellipsis transition'
                  >
                    <div className='flex items-start gap-3'>
                      <span className='bg-background text-text-secondary border-border mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium'>
                        {item.position ?? index + 1}
                      </span>
                      <span className='min-w-0 flex-1'>
                        <span className='text-foreground flex items-center gap-2 text-sm font-medium'>
                          <span className='truncate'>{item.title || 'Untitled result'}</span>
                          <ExternalLink className='text-text-info h-3.5 w-3.5 shrink-0' />
                        </span>
                        {item.link && (
                          <span className='text-primary mt-1 block truncate text-xs'>
                            {item.link}
                          </span>
                        )}
                        {item.snippet && (
                          <span className='text-text-secondary mt-2 line-clamp-2 block text-sm leading-6'>
                            {item.snippet}
                          </span>
                        )}
                        {item.date && (
                          <span className='text-text-info mt-2 block text-xs'>{item.date}</span>
                        )}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
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

export default WebSearchToolCall
