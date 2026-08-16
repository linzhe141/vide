import { useEffect } from 'react'
import { useSessionStore, useSessionStoreActions } from '@/store/sessionStore'
import type { WechatBotSessionRecord, WechatBotRuntimeStatus } from '@vide/config'

/**
 * 把微信 Bot 驱动的 agent 会话同步进前端 sessionStore。
 *
 * 微信只是 agent 的另一个入口：它创建/切换的 session 与桌面端是同一个
 * agent session（AgentManager 注册表）。此处把 wechat-sessions-changed
 * 里出现的 session id 在 sessionStore 里物化，这样 AgentManager.prompt
 * 广播的 workflow 事件才能在桌面 UI 里渲染出来 —— 实现"UI 正常更新"。
 */
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
  }, [existing, createSession])

  return null
}

