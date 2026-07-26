import type { ToolCall } from '@vide/ai'
import type { ToolResultSessionMessage } from '@/store/sessionStore/types'
import { CheckCircle2, Clock3, Ellipsis, Search, XCircle } from 'lucide-react'
import { cn, getSiteIcon } from '@/lib/utils'
import { useChatLayout } from '@/layout/ChatLayout'
import { useWebSearchStoreActions, type WebSearchResult } from '@/store/webSearchStore'

type WebSearchToolCallProps = {
  tool: ToolCall
  result?: ToolResultSessionMessage
}

function WebSearchToolCall({ tool, result }: WebSearchToolCallProps) {
  const { select } = useWebSearchStoreActions()
  const { showWebSearchResults } = useChatLayout()
  const args = parseToolArguments(tool.function.arguments)
  const query = typeof args?.query === 'string' ? args.query : tool.function.arguments
  const searchResult = result?.result as WebSearchResult | undefined
  const results = searchResult?.results ?? []
  const isRunning = !result
  const isSuccess = result?.status === 'success'
  const isError = result?.status === 'error'
  const duration = formatDuration(result?.durationMs)

  const handleClick = () => {
    if (!isSuccess || !searchResult) return

    select({
      id: tool.id,
      query,
      result: searchResult,
      durationMs: result?.durationMs,
    })
    showWebSearchResults()
  }

  return (
    <div className='space-y-2 text-sm'>
      <button
        onClick={handleClick}
        disabled={!isSuccess}
        className={cn(
          'group border-border bg-background flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition',
          'shadow-[0_1px_8px_rgba(0,0,0,0.025)] dark:shadow-none',
          isSuccess && 'hover:border-primary/35 hover:bg-primary/4 cursor-pointer',
          !isSuccess && 'cursor-default'
        )}
      >
        <div className='bg-primary/8 text-primary border-primary/10 shrink-0 rounded-lg border p-1.5'>
          <Search size={15} strokeWidth={1.9} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <span className='text-foreground truncate text-sm font-medium'>{query}</span>
            {isSuccess && (
              <div className='flex shrink-0 items-center gap-2'>
                <StatusBadge variant='success' label={`${results.length} results`} />
                <div className='flex -space-x-1.5'>
                  {results.map((item, index) =>
                    item.link ? (
                      <img
                        key={`${item.link}-${index}`}
                        src={getSiteIcon(item.link)}
                        alt=''
                        className='border-background bg-background size-5 rounded-md border'
                      />
                    ) : null
                  )}
                </div>
              </div>
            )}
            {isRunning && <StatusBadge variant='running' label='Searching' />}
            {isError && <StatusBadge variant='error' label='Failed' />}
          </div>
          <div className='text-text-secondary mt-1 flex items-center gap-2 text-xs'>
            <span>Web search</span>
            {searchResult?.didYouMean && <span>Did you mean: {searchResult.didYouMean}</span>}
          </div>
        </div>
        <div className='text-text-secondary flex shrink-0 items-center gap-2 text-xs'>
          {duration && (
            <span className='flex items-center gap-1.5'>
              <Clock3 size={13} />
              {duration}
            </span>
          )}
          {isRunning && <Ellipsis size={16} className='animate-pulse' />}
          {isSuccess && (
            <CheckCircle2 size={16} className='text-emerald-500 dark:text-emerald-300' />
          )}
          {isError && <XCircle size={16} className='text-red-500 dark:text-red-300' />}
        </div>
      </button>
      {isError && (
        <pre className='border-border bg-background text-danger rounded-xl border p-3 font-mono text-xs leading-6'>
          {JSON.stringify(result?.error, null, 2)}
        </pre>
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
      ? 'bg-success/10 text-success'
      : variant === 'running'
        ? 'bg-foreground/6 text-text-secondary dark:bg-foreground/10'
        : 'bg-danger/10 text-danger'

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
