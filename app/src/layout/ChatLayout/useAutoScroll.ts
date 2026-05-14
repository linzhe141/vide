import { useCallback, useEffect, useRef } from 'react'

export function useAutoScroll() {
  const ref = useRef<HTMLDivElement>(null)

  // 标记是否接近底部
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      el.dataset.nearBottom = distance <= 100 ? 'true' : 'false'
    }

    el.addEventListener('scroll', handleScroll)
    handleScroll()

    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // streaming 时自动滚动
  // useEffect(() => {
  //   const unsub = useSessionStore.subscribe((s) => {
  //     if (!s.streaming) return
  //     const el = ref.current
  //     if (!el) return

  //     if (el.dataset.nearBottom === 'true') {
  //       el.scrollTop = el.scrollHeight
  //     }
  //   })
  //   return unsub
  // }, [])

  const scrollToBottom = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  return { ref, scrollToBottom }
}
