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
import { useSession, useSessionStoreActions } from '../../store/sessionStore'

export function ChatContainer() {
  const { handleSend, running, sessionId } = useChatContext()
  const { scrollToBottom } = useChatLayout()
  const session = useSession(sessionId)
  const { switchSessionAutoApprove } = useSessionStoreActions()
  const onSend = useCallback(
    (text: string) => {
      handleSend(text)
      scrollToBottom()
    },
    [handleSend, scrollToBottom]
  )

  const onChangeAutoApprove = useCallback(
    (newValue: boolean) => {
      if (!session) return
      switchSessionAutoApprove(session.sessionId, newValue)
      window.ipcRendererApi.invoke('agent-session-switch-auto-approve', {
        sessionId: session.sessionId,
        autoApprove: newValue,
      })
    },
    [session, switchSessionAutoApprove]
  )
  if (!session) return null
  return (
    <ChatLayout>
      <ChatLayoutMessage>
        <MessageList />
      </ChatLayoutMessage>
      <ChatLayoutInput>
        <ChatInput
          onSend={onSend}
          running={running}
          workspacePath={session.workspacePath}
          autoApprove={session.autoApprove}
          onChangeAutoApprove={onChangeAutoApprove}
        />
      </ChatLayoutInput>
    </ChatLayout>
  )
}
