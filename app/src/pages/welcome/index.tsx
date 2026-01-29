import { useState } from 'react'
import { Textarea } from '../../ui/Textarea'
import { Button } from '../../ui/Button'
import { useThreads } from '../../hooks/useThreads'
import { useNavigate } from 'react-router'
import { context } from '../../hooks/chatContenxt'
import { useThreadStore } from '../../store/threadStore'
import { MoveRight } from 'lucide-react'
import LOGOIMG from './logo.png'

export function Welcome() {
  const { createThread } = useThreads()
  const [input, setInput] = useState('')
  const { setThreadId, setMessages } = useThreadStore()
  const navigate = useNavigate()
  const handleSend = async () => {
    if (!input.trim()) return
    context.firstInput = input
    const threadId = await createThread()
    setInput('')
    // reset current active thread store
    setThreadId(threadId)
    setMessages([])
    navigate('/chat/' + threadId)
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
        <div className='relative'>
          <div className='from-primary/20 via-primary/10 to-primary/20 absolute -inset-0.5 rounded-2xl bg-gradient-to-r opacity-30 blur'></div>
          <div className='border-border bg-background focus-within:border-primary/50 relative flex gap-3 rounded-2xl border p-4 shadow-sm transition-all focus-within:shadow-md'>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Type your message here...'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className='flex-1 border-0 bg-transparent focus:ring-0 focus:outline-none'
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              className='shrink-0 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100'
            >
              <span className='flex items-center gap-2'>
                Send
                <MoveRight></MoveRight>
              </span>
            </Button>
          </div>
        </div>

        {/* 提示建议 */}
        <div className='mt-8 grid grid-cols-1 gap-3 md:grid-cols-3'>
          {[
            { icon: '💡', text: 'Get creative ideas' },
            { icon: '📝', text: 'Write and edit content' },
            { icon: '🔍', text: 'Research and analyze' },
          ].map((suggestion, i) => (
            <button
              key={i}
              onClick={() => setInput(suggestion.text)}
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

      {/* 底部提示 */}
      <div className='absolute bottom-8 text-center'>
        <p className='text-text-info text-sm'>
          Press <kbd className='bg-border/50 rounded px-2 py-1 font-mono text-xs'>Enter</kbd> to
          send
        </p>
      </div>
    </div>
  )
}
