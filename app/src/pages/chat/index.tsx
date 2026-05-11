import { useParams } from 'react-router'
import { ChatContainer } from './ChatContainer'
import { ChatProvider } from '../../components/chat/ChatProvider'

export function Chat() {
  const { id } = useParams()
  return (
    <ChatProvider threadId={id!}>
      <ChatContainer key={id} />
    </ChatProvider>
  )
}
