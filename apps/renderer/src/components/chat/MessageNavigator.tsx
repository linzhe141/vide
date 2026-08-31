import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type MessageNavigatorProps = {
  workflowIds: string[]
}

export function MessageNavigator({ workflowIds }: MessageNavigatorProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const visibleIds = useRef<string[]>([])
  useEffect(() => {
    const anchors = workflowIds
      .map((workflowId) => document.getElementById(workflowId))
      .filter(Boolean) as HTMLElement[]

    if (!anchors.length) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleIds.current.push(entry.target.id)
          } else {
            visibleIds.current = visibleIds.current.filter((i) => i !== entry.target.id)
          }
        }
        if (!visibleIds.current.length) return

        const nextActiveId = workflowIds.find((workflowId) =>
          visibleIds.current.includes(workflowId)
        )

        if (nextActiveId) {
          setActiveId(nextActiveId)
        }
      },
      {
        root: document.getElementById('chat-wrapper'),
        threshold: 0,
        rootMargin: '0px',
      }
    )

    anchors.forEach((el) => observerRef.current!.observe(el))

    return () => observerRef.current?.disconnect()
  }, [workflowIds])

  return (
    <div className='absolute top-1/2 right-4 z-50 -translate-y-1/2'>
      <ul className='flex flex-col gap-2'>
        {workflowIds.map((workflowId, index) => {
          const active = workflowId === activeId
          return (
            <li key={workflowId}>
              <button
                type='button'
                className={cn(
                  'inline-flex h-2.5 w-8 rounded-full border border-transparent transition',
                  active ? 'bg-primary scale-110' : 'bg-border hover:bg-primary/60'
                )}
                title={`Workflow ${index + 1}`}
                aria-label={`Jump to workflow ${index + 1}`}
                onClick={() => {
                  document
                    .getElementById(workflowId)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
