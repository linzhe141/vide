import { useCallback } from 'react'
import { useChatContext, useChatRunning } from '@/hooks/useChatContext'
import { useChatLayoutScroll } from '@/hooks/useChatLayout'
import { MessageList } from '../../components/chat/MessageList'
import { ChatInput } from '../../components/chat/ChatInput'
import { ChatLayout, ChatLayoutInput, ChatLayoutMessage } from '../../layout/ChatLayout'
import {
  useHasSession,
  useHasPendingAskQuestion,
  useSessionAutoApprove,
  useSessionThinkingMode,
  useSessionWorkspacePath,
  useSessionStoreActions,
} from '../../store/sessionStore'

export function ChatContainer() {
  const { handleSend, handleStop, sessionId } = useChatContext()
  const running = useChatRunning()
  const { scrollToBottom } = useChatLayoutScroll()
  const hasSession = useHasSession(sessionId)
  const workspacePath = useSessionWorkspacePath(sessionId)
  const autoApprove = useSessionAutoApprove(sessionId)
  const thinkingMode = useSessionThinkingMode(sessionId)
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
      switchSessionAutoApprove(sessionId, newValue)
      window.ipcRendererApi.invoke('agent-session-switch-auto-approve', {
        sessionId,
        autoApprove: newValue,
      })
    },
    [sessionId, switchSessionAutoApprove]
  )

  const onChangeThinkingMode = useCallback(
    (newValue: boolean) => {
      switchSessionThinkingMode(sessionId, newValue)
      window.ipcRendererApi.invoke('agent-session-switch-thinking-mode', {
        sessionId,
        thinkingMode: newValue,
      })
    },
    [sessionId, switchSessionThinkingMode]
  )

  return (
    <ChatLayout>
      {hasSession ? (
        <>
          <ChatLayoutMessage>
            <MessageList />
          </ChatLayoutMessage>
          {!hasPendingAskQuestion && (
            <ChatLayoutInput>
              <div className='px-1 sm:px-6'>
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
