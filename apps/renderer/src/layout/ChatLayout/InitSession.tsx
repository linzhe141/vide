import { useSession, useSessionStoreActions } from '../../store/sessionStore'
import { useEffect } from 'react'
import { context } from '../../hooks/chatContenxt'
import { useChatContext } from '../../components/chat/ChatProvider'

/**
 * 在进入 chat 页时处理“第一句输入”的暂存逻辑。
 *
 * 会话的创建/重建不再通过 loadSession 主动拉取（已移除），而是由全局
 * useAgentSessionEvent 监听 background-create-session 事件驱动 sessionStore/historyStore。
 * 这里只负责把 welcome 页暂存的首条输入发出去。
 */
export function InitSession({ sessionId }: { sessionId: string }) {
  const { handleSend } = useChatContext()
  const { createSession } = useSessionStoreActions()
  const currentSession = useSession(sessionId)
  useEffect(() => {
    const firstInput = context.firstInput

    if (firstInput) {
      context.firstInput = ''
      if (!currentSession) {
        createSession({ sessionId })
      }
      handleSend(firstInput)
      return
    }
    // 非首条输入：会话由 background-create-session 事件创建，这里无需额外处理
  }, [sessionId, handleSend, createSession, currentSession])

  return null
}
