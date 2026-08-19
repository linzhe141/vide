import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSessionRuntime, useSessionWorkflows } from '@/store/sessionStore'

type UseAutoScrollOptions = {
  sessionId: string
  threshold?: number
}

export function useAutoScroll({ sessionId, threshold = 100 }: UseAutoScrollOptions) {
  const ref = useRef<HTMLDivElement>(null)
  const runtime = useSessionRuntime(sessionId)
  const sessionWorkflows = useSessionWorkflows(sessionId)
  const workflows = useMemo(() => sessionWorkflows ?? [], [sessionWorkflows])

  const updateNearBottom = useCallback(
    (el: HTMLDivElement) => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      el.dataset.nearBottom = distance <= threshold ? 'true' : 'false'
    },
    [threshold]
  )

  // 标记是否接近底部
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleScroll = () => {
      updateNearBottom(el)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => el.removeEventListener('scroll', handleScroll)
  }, [updateNearBottom])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!runtime?.running) {
      updateNearBottom(el)
      return
    }

    if (el.dataset.nearBottom !== 'false') {
      el.scrollTop = el.scrollHeight
      updateNearBottom(el)
    }
  }, [runtime?.running, updateNearBottom, workflows])

  const scrollToBottom = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    updateNearBottom(el)
  }, [updateNearBottom])

  return { ref, scrollToBottom }
}
