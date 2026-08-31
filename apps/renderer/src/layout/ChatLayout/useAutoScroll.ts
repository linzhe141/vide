import { useCallback, useEffect, useRef } from 'react'
import { useSessionRenderVersion, useSessionRunning } from '@/store/sessionStore'

type UseAutoScrollOptions = {
  sessionId: string
  threshold?: number
}

export function useAutoScroll({ sessionId, threshold = 100 }: UseAutoScrollOptions) {
  const ref = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const running = useSessionRunning(sessionId)
  const renderVersion = useSessionRenderVersion(sessionId)

  const updateNearBottom = useCallback(
    (el: HTMLDivElement) => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      el.dataset.nearBottom = distance <= threshold ? 'true' : 'false'
    },
    [threshold]
  )

  const syncScrollPosition = useCallback(() => {
    const el = ref.current
    if (!el) return

    if (!running) {
      updateNearBottom(el)
      return
    }

    if (el.dataset.nearBottom !== 'false') {
      el.scrollTop = el.scrollHeight
    }

    updateNearBottom(el)
  }, [running, updateNearBottom])

  const scheduleScrollSync = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      syncScrollPosition()
    })
  }, [syncScrollPosition])

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
    scheduleScrollSync()
  }, [renderVersion, running, scheduleScrollSync])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      scheduleScrollSync()
    })

    observer.observe(el)

    return () => observer.disconnect()
  }, [scheduleScrollSync])

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    updateNearBottom(el)
  }, [updateNearBottom])

  return { ref, scrollToBottom }
}
