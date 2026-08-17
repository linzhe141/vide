import { useCallback, useEffect, useMemo } from 'react'
import { GitBranch, LoaderCircle } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/store/sessionStore'
import { useHistoryItems, useHistoryStoreActions } from '@/store/historyStore'

export function SessionRecents() {
  const historyItems = useHistoryItems()
  const historyActions = useHistoryStoreActions()
  const sortedHistory = useMemo(
    () => [...historyItems].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [historyItems]
  )

  const fetchChats = useCallback(() => {
    void historyActions.fetch()
  }, [historyActions])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  useEffect(() => {
    const disposers = [
      window.ipcRendererApi.on('workflow.llm.start', () => {
        setTimeout(fetchChats, 250)
      }),
    ]

    return () => {
      disposers.forEach((dispose) => dispose())
    }
  }, [fetchChats])

  return (
    <div className='flex flex-1 flex-col gap-0.5 overflow-y-auto px-2'>
      {sortedHistory.map((history) => (
        <HistoryNavItem
          key={history.sessionId}
          sessionId={history.sessionId}
          title={history.title}
        />
      ))}

      {sortedHistory.length === 0 && (
        <div className='text-text-info px-3 py-4 text-sm'>No active sessions</div>
      )}
    </div>
  )
}

function HistoryNavItem({ sessionId, title }: { sessionId: string; title: string }) {
  const running = useSessionStore((state) => {
    const session = state.sessions.find((item) => item.sessionId === sessionId)
    return session?.runtime.running ?? false
  })
  const sessionType = useSessionStore((state) => {
    const session = state.sessions.find((item) => item.sessionId === sessionId)
    return session?.sessionType ?? null
  })

  return (
    <NavLink
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
        {sessionType === 'fork' ? (
          <span className='text-primary inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10'>
            <GitBranch size={11} />
          </span>
        ) : null}
        <span className='block flex-1 truncate'>{title || 'Untitled'}</span>
        {running ? <LoaderCircle size={13} className='text-text-info animate-spin' /> : null}
      </div>
    </NavLink>
  )
}
