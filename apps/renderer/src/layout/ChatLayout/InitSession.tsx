import { useSession, useSessionStoreActions } from '../../store/sessionStore'
import { useEffect } from 'react'
import { context } from '../../hooks/chatContenxt'
import { useChatContext } from '../../components/chat/ChatProvider'

export function InitSession({ sessionId }: { sessionId: string }) {
  const { handleSend } = useChatContext()
  const { createSession } = useSessionStoreActions()
  const currentSession = useSession(sessionId)
  useEffect(() => {
    const firstInput = context.firstInput

    if (firstInput) {
      context.firstInput = ''
      handleSend(firstInput)
      return
    }
    if (!currentSession) {
      createSession({ sessionId })
    }
  }, [sessionId, handleSend, createSession, currentSession])
  return null
}
