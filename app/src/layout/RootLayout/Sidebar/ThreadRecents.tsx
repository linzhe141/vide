import { NavLink } from 'react-router'
import { cn } from '@/app/src/lib/utils'
import { useCallback, useEffect } from 'react'
import { useThreadsStore } from '@/app/src/store/threadsStore'

export function ThreadRecents() {
  const { threads, setThreads } = useThreadsStore()

  const fetchChats = useCallback(
    async function fetchChats() {
      const res = await window.ipcRendererApi.invoke('get-threads-list')
      const result = res
      setThreads(result)
    },
    [setThreads]
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
      {threads.map((thread) => (
        <NavLink
          key={thread.id}
          to={`/chat/${thread.id}`}
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
          <span className='block truncate'>{thread.title || 'Untitled'}</span>
        </NavLink>
      ))}

      {threads.length === 0 && (
        <div className='text-text-info px-3 py-4 text-sm'>No active threads</div>
      )}
    </div>
  )
}
