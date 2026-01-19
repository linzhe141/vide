import { useEffect, useRef, useState } from 'react'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { context } from '../../hooks/chatContenxt'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import type { ToolCall } from '@/agent/core/types'
import { ArrowDown } from 'lucide-react'
import { useThreadStore } from '../../store/threadStore'

// 用户消息组件
function UserMessage({ content }: { content: string }) {
  return (
    <div className='flex'>
      <div className='bg-primary max-w-2xl rounded-2xl px-5 py-3 shadow-sm'>
        <p className='text-sm leading-relaxed text-white'>{content}</p>
      </div>
    </div>
  )
}

// 助手消息组件
function AssistantMessage({ content }: { content: string }) {
  return (
    <div className='flex justify-start'>
      <div className='border-border max-w-3xl rounded-2xl border px-5 py-3 shadow-sm'>
        <pre className='text-sm leading-relaxed whitespace-pre-line'>{content}</pre>
      </div>
    </div>
  )
}

// 工具调用组件
function ToolCallItem({
  toolCall,
  isApproved,
  needsApproval,
  onApprove,
  onReject,
}: {
  toolCall: ToolCall
  isApproved: boolean
  needsApproval: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className='border-border mt-2 ml-0 max-w-3xl rounded-xl border p-4'>
      <div className='mb-2 flex items-center gap-2'>
        <div className='h-1.5 w-1.5 rounded-full bg-blue-500'></div>
        <span className='text-xs font-medium text-gray-600'>工具调用</span>
      </div>
      <pre className='overflow-auto rounded-lg p-3 text-xs'>
        {JSON.stringify(toolCall, null, 2)}
      </pre>

      {!isApproved && needsApproval && (
        <div className='mt-3 border-t pt-3'>
          <p className='mb-3 text-xs font-medium text-gray-600'>需要确认工具调用</p>
          <div className='flex gap-2'>
            <Button onClick={onApprove} className='h-8 rounded-lg text-xs font-medium'>
              批准
            </Button>
            <Button
              onClick={onReject}
              variant='outline'
              className='border-border h-8 rounded-lg border text-xs font-medium'
            >
              拒绝
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// 工具结果组件
function ToolMessage({ content }: { content: any }) {
  return (
    <div className='flex justify-start'>
      <div className='border-border max-w-3xl rounded-xl border p-4'>
        <div className='mb-2 flex items-center gap-2'>
          <div className='h-1.5 w-1.5 rounded-full bg-green-500'></div>
          <span className='text-xs font-medium text-gray-600'>工具结果</span>
        </div>
        <pre className='overflow-auto rounded-lg p-3 text-xs'>
          {JSON.stringify(content, null, 2)}
        </pre>
      </div>
    </div>
  )
}

// 状态提示组件
function StatusIndicator({ isFinished, isAborted }: { isFinished: boolean; isAborted: boolean }) {
  if (!isFinished && !isAborted) return null

  return (
    <div className='flex justify-center py-2'>
      <div
        className={`rounded-full px-4 py-1.5 text-xs font-medium shadow-sm ${
          isFinished
            ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
            : 'bg-red-50 text-red-700 ring-1 ring-red-200'
        }`}
      >
        {isFinished ? '✓ 完成' : '✕ 已中止'}
      </div>
    </div>
  )
}

// 滚动到底部按钮
function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className='border-border fixed bottom-28 left-1/2 -translate-x-1/2 rounded-full border p-3 shadow-lg transition-all hover:scale-105 hover:shadow-xl'
      aria-label='滚动到底部'
    >
      <ArrowDown size={18} className='text-gray-700' />
    </button>
  )
}

// 主聊天组件
export function Chat() {
  const { messages } = useThreadStore()
  const [input, setInput] = useState('')
  const { send, workflowState, isAborted, isFinished, abort, isRunning } = useWorkflowStream()

  const [approvedToolCalls, setApprovedCalls] = useState<Set<string>>(new Set())
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [showToBottomButton, setShowToBottomButton] = useState(false)

  useEffect(() => {
    const firstInput = context.firstInput
    if (firstInput) {
      console.log('firstInput', firstInput)
      context.firstInput = ''
      send(firstInput)
    }
  }, [send])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setShowToBottomButton(!entry.isIntersecting)
        })
      },
      { threshold: 0.5 }
    )
    if (placeholderRef.current) {
      observer.observe(placeholderRef.current)
    }
    return () => observer.disconnect()
  }, [])

  const handleSend = async () => {
    if (!input.trim()) return
    await send(input)
    setInput('')
  }

  const handleApprove = (id: string) => {
    setApprovedCalls((prev) => new Set(prev).add(id))
    window.ipcRendererApi.invoke('agent-human-approved')
  }

  const handleReject = () => {}

  const toBottom = () => {
    placeholderRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className='flex h-full w-full flex-col'>
      {/* 消息区域 */}
      <div className='flex-1 overflow-auto'>
        <div className='mx-auto max-w-4xl space-y-4 px-4 py-6'>
          {messages.map((msg, idx) => {
            switch (msg.role) {
              case 'user':
                return <UserMessage key={idx} content={msg.content as string} />

              case 'assistant':
                return (
                  <div key={idx} className='space-y-3'>
                    {msg.content && <AssistantMessage content={msg.content as string} />}
                    {msg.tool_calls?.map((toolCall, index) => (
                      <ToolCallItem
                        key={`${idx}-${index}`}
                        toolCall={toolCall as ToolCall}
                        isApproved={approvedToolCalls.has(toolCall.id + idx + index)}
                        needsApproval={workflowState === 'workflow-wait-human-approve'}
                        onApprove={() => handleApprove(toolCall.id + idx + index)}
                        onReject={handleReject}
                      />
                    ))}
                  </div>
                )

              case 'tool':
                return <ToolMessage key={idx} content={msg} />

              default:
                return null
            }
          })}

          {messages.length > 0 && <StatusIndicator isFinished={isFinished} isAborted={isAborted} />}

          <div ref={placeholderRef} className='h-32' />
        </div>
      </div>

      {showToBottomButton && <ScrollToBottomButton onClick={toBottom} />}

      {/* 输入区域 */}
      <div className='border-border border-t'>
        <div className='mx-auto max-w-4xl px-4 py-4'>
          <div className='flex gap-2'>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='输入消息...'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className='focus:border-primary focus:ring-primary border-border flex-1 rounded-xl'
            />
            <Button
              onClick={handleSend}
              disabled={isRunning}
              className='rounded-xl px-6 font-medium'
            >
              发送
            </Button>
            <Button
              onClick={abort}
              disabled={!isRunning}
              className='border-border rounded-xl border px-6 font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100'
            >
              中止
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
