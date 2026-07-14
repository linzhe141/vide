import { ExternalLink, Search, X } from 'lucide-react'
import { cn, getSiteIcon } from '../../lib/utils'
import { useSelectedWebSearch, type WebSearchResultItem } from '../../store/webSearchStore'
import { useChatLayout } from '.'

export function WebSearchDisplay({ className }: { className?: string }) {
  const selected = useSelectedWebSearch()
  const results = selected?.result.results ?? []
  const { closePane } = useChatLayout()

  return (
    <div className={cn('bg-background flex h-full flex-col', className)}>
      <div className='border-border flex items-center gap-3 border-b px-4 py-3'>
        <div className='bg-primary/8 text-primary border-primary/10 rounded-lg border p-1.5'>
          <Search size={15} strokeWidth={1.9} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-foreground truncate text-sm font-medium'>{selected?.query}</div>
          <div className='text-text-secondary mt-0.5 flex items-center gap-2 text-xs'>
            <span>{results.length} results</span>
            {selected?.result.didYouMean && (
              <span>Did you mean: {selected?.result.didYouMean}</span>
            )}
          </div>
        </div>
        <div>
          <X
            className='text-text-secondary hover:text-foreground size-4.5 cursor-pointer'
            onClick={() => {
              closePane?.()
            }}
          />
        </div>
      </div>

      <div className='h-0 flex-1 overflow-y-auto p-3'>
        <div className='grid gap-2'>
          {results.map((item, index) => (
            <WebSearchResultCard key={`${item.link}-${index}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}

function WebSearchResultCard({ item }: { item: WebSearchResultItem }) {
  const content = (
    <div className='border-border bg-background hover:border-primary/30 hover:bg-primary/4 overflow-hidden rounded-xl border p-3 transition'>
      <div className='flex items-start gap-3'>
        <div className='rounded-lg border'>
          <img src={getSiteIcon(item.link)} alt='' className='size-4 rounded-sm' />
        </div>
        <div className='w-0 flex-1'>
          <div className='text-foreground flex items-center gap-2 text-sm font-medium'>
            <span className='truncate'>{item.title || 'Untitled result'}</span>
            {item.link && <ExternalLink className='text-text-info size-3.5 shrink-0' />}
          </div>
          {item.link && <div className='text-primary mt-1 truncate text-xs'>{item.link}</div>}
          {item.snippet && (
            <div className='text-text-secondary mt-2 line-clamp-3 text-sm leading-6'>
              {item.snippet}
            </div>
          )}
          {item.date && <div className='text-text-info mt-2 text-xs'>{item.date}</div>}
        </div>
      </div>
    </div>
  )

  if (!item.link) return content

  return (
    <a href={item.link} className='block w-full' target='_blank' rel='noreferrer'>
      {content}
    </a>
  )
}
