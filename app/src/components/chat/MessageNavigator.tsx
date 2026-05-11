import { useEffect, useRef, useState } from 'react'
import { cn } from '@/app/src/lib/utils'

type MessageNavigatorItem = {
  id: string
  label: string
  index: number
}

type MessageNavigatorProps = {
  items: MessageNavigatorItem[]
}

export function MessageNavigator({ items }: MessageNavigatorProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const visibleIds = useRef<string[]>([])
  useEffect(() => {
    const anchors = items
      .map((item) => document.getElementById(item.id))
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

        const nextActive = items
          .filter((item) => visibleIds.current.includes(item.id))
          .sort((a, b) => a.index - b.index)[0]

        if (nextActive) {
          setActiveId(nextActive.id)
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
  }, [items])

  return (
    <div className='fixed top-1/2 right-4 z-50 -translate-y-1/2'>
      <ul className='flex flex-col gap-2'>
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <li
              key={item.id}
              className={cn(
                'h-1.5 w-5 cursor-pointer rounded-full transition-all',
                active ? 'bg-primary scale-125' : 'bg-border hover:bg-primary/60'
              )}
              title={item.label}
              onClick={() => {
                document
                  .getElementById(item.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            />
          )
        })}
      </ul>
    </div>
  )
}
