import { useSession, useSessionStoreActions } from '../../store/sessionStore'
import { useEffect, useRef } from 'react'
import { context } from '../../hooks/chatContenxt'
import { useChatContext } from '@/hooks/useChatContext'

/**
 * 在进入 chat 页时处理“首条输入”的暂存以及持久化 session 的加载。
 *
 * - 新会话：welcome 页暂存的首条输入在这里发出去；会话占位由全局
 *   useAgentSessionEvent 监听到 background-create-session 后写入 sessionStore。
 * - 已存在的持久化会话（重启后 / 从历史列表进入）：通过 loadSession 从 SQLite
 *   拉取完整数据；若 main 进程里还有未落库的运行中 workflow，再补回放 recordedEvents，
 *   让 UI 恢复 streaming 状态并继续接收后续事件。
 */
export function InitSession({ sessionId }: { sessionId: string }) {
  const { handleSend } = useChatContext()
  const { createSession, loadSession } = useSessionStoreActions()
  const currentSession = useSession(sessionId)
  const loadedRef = useRef(false)

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

    // 非首条输入：若是尚未加载的持久化 session，则从 SQLite 拉取
    if (!currentSession && !loadedRef.current) {
      loadedRef.current = true
      loadSession(sessionId)
    }
  }, [sessionId, handleSend, createSession, loadSession, currentSession])

  return null
}
