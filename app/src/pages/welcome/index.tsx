import { useNavigate } from 'react-router'
import { context } from '../../hooks/chatContenxt'
import LOGOIMG from './logo.png'
import { useSessionStoreActions } from '../../store/sessionStore'
import { ChatInput } from '../../components/chat/ChatInput'

export function Welcome() {
  const { createSession } = useSessionStoreActions()

  const navigate = useNavigate()
  const handleSend = async (input: string) => {
    context.firstInput = input
    const sessionId = await window.ipcRendererApi.invoke('agent-create-session')
    createSession({ sessionId })
    navigate('/chat/' + sessionId)
  }

  return (
    <div className='flex h-full w-full flex-col items-center justify-center gap-12 px-6'>
      {/* 标题和描述 */}
      <div className='flex flex-col items-center text-center'>
        <img className='size-80' src={LOGOIMG}></img>
        <p className='text-text-secondary -mt-10 max-w-md text-lg'>
          Start a conversation with your AI assistant. Ask anything, explore ideas, or get help with
          your tasks.
        </p>
      </div>

      {/* 输入区域 */}
      <div className='w-full max-w-3xl'>
        <ChatInput onSend={handleSend} running={false} />

        {/* 提示建议 */}
        <div className='mt-8 grid grid-cols-1 gap-3 md:grid-cols-3'>
          {[
            { icon: '💡', text: 'Get creative ideas' },
            { icon: '📝', text: 'Write and edit content' },
            { icon: '🔍', text: 'Research and analyze' },
          ].map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSend(suggestion.text)}
              className='group border-border bg-background/50 hover:border-primary/50 hover:bg-background flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition-all hover:shadow-sm'
            >
              <span className='text-2xl transition-transform group-hover:scale-110'>
                {suggestion.icon}
              </span>
              <span className='text-text-secondary group-hover:text-foreground transition-colors'>
                {suggestion.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
