import { useEffect, useRef } from 'react'
import { useSessionStore, useSessionStoreActions } from '@/store/sessionStore'
import type { WechatBotSessionRecord, WechatBotRuntimeStatus } from '@vide/config'
import { createBackgroundPromptWorkflowStream } from '@/hooks/createWorkflowStream'

export function WechatSessionSync() {
  const existing = useSessionStore((state) => state.sessions)
  const { createSession, handleEvent } = useSessionStoreActions()
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

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
  }, [existing, createSession])

  useEffect(() => {
    const cleanup = () => {
      readerRef.current?.cancel().catch(() => {})
      readerRef.current = null
      abortControllerRef.current = null
    }

    const remove = window.ipcRendererApi.on('agent-session-background-send', async (data) => {
      const sessionId = data.sessionId
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      const stream = createBackgroundPromptWorkflowStream(sessionId, abortController.signal)
      const reader = stream.getReader()
      readerRef.current = reader

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (!value) continue
          handleEvent(value)
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(err)
        }
      } finally {
        reader.releaseLock()
        cleanup()
      }
    })
    return remove
  }, [handleEvent])
  return null
}
