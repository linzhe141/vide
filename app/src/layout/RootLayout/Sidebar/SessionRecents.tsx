import { useCallback, useEffect } from 'react'
import { GitBranch } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { useSessionsStore } from '@/app/src/store/sessionsStore'

export function SessionRecents() {
  const { sessions, setSessions } = useSessionsStore()

  const fetchChats = useCallback(async () => {
    const result = await window.ipcRendererApi.invoke('get-sessions-list')
    setSessions(result)
  }, [setSessions])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  useEffect(() => {
    const disposers = [
      window.ipcRendererApi.on('workflow-llm-start', () => {
        setTimeout(fetchChats, 250)
      }),
      window.ipcRendererApi.on('agent-create-session', () => {
        setTimeout(fetchChats, 50)
      }),
      window.ipcRendererApi.on('agent-session-forked', () => {
        setTimeout(fetchChats, 50)
      }),
    ]

    return () => {
      disposers.forEach((dispose) => dispose())
    }
  }, [fetchChats])

  return (
    <div className='flex flex-1 flex-col gap-0.5 overflow-y-auto px-2'>
      {sessions.map((session) => (
        <NavLink
          key={session.id}
          to={`/chat/${session.id}`}
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
            {session.type === 'fork' ? (
              <span className='text-primary inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10'>
                <GitBranch size={11} />
              </span>
            ) : null}
            <span className='block truncate'>{session.title || 'Untitled'}</span>
          </div>
        </NavLink>
      ))}

      {sessions.length === 0 && (
        <div className='text-text-info px-3 py-4 text-sm'>No active sessions</div>
      )}
    </div>
  )
}
