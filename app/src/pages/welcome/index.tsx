import { useState } from 'react'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { useThreads } from '../../hooks/useThreads'
import { useNavigate } from 'react-router'
import { context } from '../../hooks/chatContenxt'

export function Welcome() {
  const [input, setInput] = useState('')
  const navigate = useNavigate()

  const { createThread } = useThreads()

  const handleSend = async () => {
    if (!input.trim()) return
    context.firstInput = input
    const threadId = await createThread()
    setInput('')
    navigate('/chat/' + threadId)
  }

  return (
    <div className='flex h-full w-full items-center justify-center'>
      {/* 输入区域 */}
      <div className='flex min-w-[800px] gap-2 p-3'>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Type your message...'
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  )
}
