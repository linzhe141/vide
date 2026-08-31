import { useCallback, useEffect, useMemo } from 'react'
import { GitBranch, LoaderCircle, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/sessionStore'
import { useHistoryItems, useHistoryStoreActions } from '@/store/historyStore'
import { RouterLink } from '@/components/RouterLink'

export function SessionRecents() {
  const historyItems = useHistoryItems()
  const historyActions = useHistoryStoreActions()
  const sortedHistory = useMemo(
    () => [...historyItems].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [historyItems]
  )

  const fetchChats = useCallback(() => {
    historyActions.fetch()
  }, [historyActions])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  return (
    <div className='flex flex-1 flex-col gap-0.5 overflow-y-auto px-2'>
      {sortedHistory.map((history) => (
        <HistoryNavItem
          key={history.sessionId}
          sessionId={history.sessionId}
          title={history.title}
          type={history.type}
          sessionSource={history.sessionSource}
        />
      ))}

      {sortedHistory.length === 0 && (
        <div className='text-text-info px-3 py-4 text-sm'>No active sessions</div>
      )}
    </div>
  )
}

function HistoryNavItem({
  sessionId,
  title,
  type,
  sessionSource,
}: {
  sessionId: string
  title: string
  type: 'normal' | 'fork'
  sessionSource: 'desktop' | 'wechat-bot'
}) {
  const running = useSessionStore((state) => {
    const session = state.sessions.find((item) => item.sessionId === sessionId)
    return session?.runtime.running ?? false
  })

  return (
    <RouterLink
      key={sessionId}
      to={`/chat/${sessionId}`}
      className={({ isActive }) =>
        cn(
          'rounded-md px-3 py-1.5',
          'text-sm',
          'text-text-secondary',
          'transition-colors',
          'hover:bg-foreground/5 hover:text-foreground',
          isActive && 'bg-foreground/8 text-foreground font-medium'
        )
      }
    >
      <div className='flex items-center gap-2'>
        {type === 'fork' ? (
          <span className='text-primary inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10'>
            <GitBranch size={11} />
          </span>
        ) : null}
        {sessionSource === 'wechat-bot' ? (
          <span className='inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'>
            <MessageCircle size={11} />
          </span>
        ) : null}
        <span className='block flex-1 truncate'>{title || 'Untitled'}</span>
        {running ? <LoaderCircle size={13} className='text-text-info animate-spin' /> : null}
      </div>
    </RouterLink>
  )
}
