import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { useCallback, useEffect } from 'react'
import { useSessionsStore } from '@/app/src/store/sessionsStore'

export function SessionRecents() {
  const { sessions, setSessions } = useSessionsStore()

  const fetchChats = useCallback(
    async function fetchChats() {
      const res = await window.ipcRendererApi.invoke('get-sessions-list')
      const result = res
      setSessions(result)
    },
    [setSessions]
  )
  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  useEffect(() => {
    const remove = window.ipcRendererApi.on('workflow-llm-start', () => {
      // 等写入数据库
      setTimeout(fetchChats, 250)
    })
    return remove
  })

  return (
    <div className='flex flex-1 flex-col gap-0.5 overflow-y-auto px-2'>
      {sessions.map((session) => (
        <NavLink
          key={session.id}
          to={`/chat/${session.id}`}
          onClick={async () => {
            //
          }}
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
          <span className='block truncate'>{session.title || 'Untitled'}</span>
        </NavLink>
      ))}

      {sessions.length === 0 && (
        <div className='text-text-info px-3 py-4 text-sm'>No active sessions</div>
      )}
    </div>
  )
}
