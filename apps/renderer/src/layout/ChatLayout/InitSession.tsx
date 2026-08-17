import { useSession, useSessionStoreActions } from '../../store/sessionStore'
import { useEffect } from 'react'
import { context } from '../../hooks/chatContenxt'
import { useChatContext } from '../../components/chat/ChatProvider'

export function InitSession({ sessionId }: { sessionId: string }) {
  const { handleSend } = useChatContext()
  const { createSession, loadSession } = useSessionStoreActions()
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
    } else {
      loadSession(sessionId)
    }
  }, [sessionId, handleSend, createSession, currentSession, loadSession])

  return null
}
