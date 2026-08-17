import { useEffect } from 'react'
import { useSessionStore, useSessionStoreActions } from '@/store/sessionStore'
import type { WechatBotSessionRecord, WechatBotRuntimeStatus } from '@vide/config'

export function WechatSessionSync() {
  const existing = useSessionStore((state) => state.sessions)
  const { createSession } = useSessionStoreActions()

  useEffect(() => {
    const dispose = window.ipcRendererApi.on(
      'wechat-sessions-changed',
      (data: {
        activeSessionId: string | null
        sessions: WechatBotSessionRecord[]
        status: WechatBotRuntimeStatus
      }) => {
        const knownIds = new Set(existing.map((s) => s.sessionId))
        for (const rec of data.sessions ?? []) {
          if (!knownIds.has(rec.sessionId)) {
            createSession({ sessionId: rec.sessionId })
            knownIds.add(rec.sessionId)
          }
        }
      }
    )
    return () => dispose()
    // existing 会随 session 新建而变化，这里只需在初始阶段同步一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSession])

  return null
}
