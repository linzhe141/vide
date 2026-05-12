import { useCallback } from 'react'
import { useChatContext } from '../../components/chat/ChatProvider'
import { MessageList } from '../../components/chat/MessageList'
import { ChatInput } from '../../components/chat/ChatInput'
import {
  ChatLayout,
  ChatLayoutInput,
  ChatLayoutMessage,
  useChatLayout,
} from '../../layout/ChatLayout'

export function ChatContainer() {
  const { handleSend } = useChatContext()
  const { scrollToBottom } = useChatLayout()
  const onSend = useCallback(
    (text: string) => {
      handleSend(text)
      scrollToBottom()
    },
    [handleSend, scrollToBottom]
  )

  return (
    <ChatLayout>
      <ChatLayoutMessage>
        <MessageList />
      </ChatLayoutMessage>
      <ChatLayoutInput>
        <ChatInput onSend={onSend} />
      </ChatLayoutInput>
    </ChatLayout>
  )
}
