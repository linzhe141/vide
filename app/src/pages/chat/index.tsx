import { ChatProvider, useChatContext } from './ChatProvider'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ScrollToBottomButton } from './ChatUIComponents'

function ChatContent() {
  const { showToBottomButton } = useChatContext()

  return (
    <div className='bg-background flex h-full w-full flex-col'>
      <MessageList />
      {showToBottomButton && <ScrollToBottomButton />}
      <ChatInput />
    </div>
  )
}

export function Chat() {
  return (
    <ChatProvider>
      <ChatContent />
    </ChatProvider>
  )
}
