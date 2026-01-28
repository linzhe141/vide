import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useParams } from 'react-router'
import { memo } from 'react'
import { ChatProvider } from './ChatProvider'

export function Chat() {
  const params = useParams()
  const id = params.id!
  return (
    <ChatProvider key={id}>
      <ChatContentMemo key={id} chatId={id} />
    </ChatProvider>
  )
}

function ChatContent(_props: { chatId: string }) {
  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <MessageList />

      <ChatInput />
    </div>
  )
}

const ChatContentMemo = memo(ChatContent)
