import { useParams } from 'react-router'
import { useEffect } from 'react'
import { ChatContainer } from './ChatContainer'
import { ChatProvider } from '../../components/chat/ChatProvider'
import { ChatLayoutProvider } from '../../layout/ChatLayout'
import { useWebSearchStoreActions } from '../../store/webSearchStore'

export function Chat() {
  const { id } = useParams()
  const { clear } = useWebSearchStoreActions()

  useEffect(() => {
    clear()
    return () => clear()
  }, [clear, id])

  return (
    <ChatProvider sessionId={id!}>
      <ChatLayoutProvider key={id}>
        <ChatContainer key={id} />
      </ChatLayoutProvider>
    </ChatProvider>
  )
}
