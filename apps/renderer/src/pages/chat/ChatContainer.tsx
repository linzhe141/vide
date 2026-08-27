import { useCallback } from 'react'
import { useChatContext } from '@/hooks/useChatContext'
import { useChatLayoutScroll } from '@/hooks/useChatLayout'
import { MessageList } from '../../components/chat/MessageList'
import { ChatInput } from '../../components/chat/ChatInput'
import { ChatLayout, ChatLayoutInput, ChatLayoutMessage } from '../../layout/ChatLayout'
import {
  useHasPendingAskQuestion,
  useHasSession,
  useSessionAutoApprove,
  useSessionThinkingMode,
  useSessionWorkspacePath,
  useSessionStoreActions,
} from '../../store/sessionStore'

export function ChatContainer() {
  const { handleSend, handleStop, running, sessionId } = useChatContext()
  const { scrollToBottom } = useChatLayoutScroll()
  const hasSession = useHasSession(sessionId)
  const workspacePath = useSessionWorkspacePath(sessionId)
  const autoApprove = useSessionAutoApprove(sessionId) ?? false
  const thinkingMode = useSessionThinkingMode(sessionId) ?? false
  const hasPendingAskQuestion = useHasPendingAskQuestion(sessionId)
  const { switchSessionAutoApprove, switchSessionThinkingMode } = useSessionStoreActions()
  const onSend = useCallback(
    (text: string) => {
      handleSend(text)
      scrollToBottom()
    },
    [handleSend, scrollToBottom]
  )

  const onChangeAutoApprove = useCallback(
    (newValue: boolean) => {
      if (!hasSession) return
      switchSessionAutoApprove(sessionId, newValue)
      window.ipcRendererApi.invoke('agent-session-switch-auto-approve', {
        sessionId,
        autoApprove: newValue,
      })
    },
    [hasSession, sessionId, switchSessionAutoApprove]
  )

  const onChangeThinkingMode = useCallback(
    (newValue: boolean) => {
      if (!hasSession) return
      switchSessionThinkingMode(sessionId, newValue)
      window.ipcRendererApi.invoke('agent-session-switch-thinking-mode', {
        sessionId,
        thinkingMode: newValue,
      })
    },
    [hasSession, sessionId, switchSessionThinkingMode]
  )

  // if (!session) return null
  return (
    <ChatLayout>
      {hasSession ? (
        <>
          <ChatLayoutMessage>
            <MessageList />
          </ChatLayoutMessage>
          {!hasPendingAskQuestion && (
            <ChatLayoutInput className='absolute bottom-5 left-1/2 z-10 -translate-x-1/2'>
              <div className='px-10'>
                <ChatInput
                  running={running}
                  workspacePath={workspacePath}
                  autoApprove={autoApprove}
                  thinkingMode={thinkingMode}
                  onSend={onSend}
                  onStop={handleStop}
                  onChangeAutoApprove={onChangeAutoApprove}
                  onChangeThinkingMode={onChangeThinkingMode}
                />
              </div>
            </ChatLayoutInput>
          )}
        </>
      ) : null}
    </ChatLayout>
  )
}
