import { Send } from 'lucide-react'
import { useState, useRef, useEffect, memo } from 'react'
import { Textarea } from '@/app/src/ui/Textarea'
import { Button } from '@/app/src/ui/Button'

export const ChatInput = memo(function ChatInput({ onSend }: { onSend: (input: string) => void }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (input.trim()) {
      onSend(input)
      setInput('')
    }
  }

  return (
    <div className='border-border bg-background focus-within:border-primary focus-within:ring-primary/10 relative flex flex-col rounded-2xl border shadow-sm transition-all focus-within:ring-2'>
      <div className='h-0 flex-1 overflow-auto'>
        <div className='h-1.5'></div>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          disabled={false}
          className='text-foreground placeholder:text-text-info w-full resize-none rounded-2xl border-0 bg-transparent px-4 focus:ring-0 focus:outline-none disabled:opacity-50'
          rows={1}
          style={{ minHeight: '52px', maxHeight: '200px' }}
        />
      </div>

      <div className='flex items-center justify-between gap-2 px-4 py-2'>
        <div>{/* 可以放一些快捷输入的按钮或者功能提示 */}</div>
        <div>
          <Button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className='bg-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
          >
            <Send className='h-4 w-4' />
            <span>Send</span>
          </Button>
        </div>
      </div>
    </div>
  )
})
