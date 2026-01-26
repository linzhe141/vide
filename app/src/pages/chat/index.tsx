import { ChatProvider, useChatContext } from './ChatProvider'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ScrollToBottomButton } from './ChatUIComponents'
import { useParams } from 'react-router'
import { memo } from 'react'

export function Chat() {
  const params = useParams()
  const id = params.id!
  return (
    <ChatProvider>
      <ChatContentMemo chatId={id} />
    </ChatProvider>
  )
}

function ChatContent(_props: { chatId: string }) {
  const { showToBottomButton } = useChatContext()

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <MessageList />
      {showToBottomButton && <ScrollToBottomButton />}
      <ChatInput />
    </div>
  )
}

const ChatContentMemo = memo(ChatContent)
