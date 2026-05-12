import { useParams } from 'react-router'
import { ChatContainer } from './ChatContainer'
import { ChatProvider } from '../../components/chat/ChatProvider'
import { ChatLayoutProvider } from '../../layout/ChatLayout'

export function Chat() {
  const { id } = useParams()
  return (
    <ChatProvider threadId={id!}>
      <ChatLayoutProvider>
        <ChatContainer key={id} />
      </ChatLayoutProvider>
    </ChatProvider>
  )
}
