import { useEffect, useRef, useState } from 'react'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { useParams } from 'react-router'
import { context } from '../../hooks/chatContenxt'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import type { ToolCall } from '@/agent/core/types'
import { ArrowDown } from 'lucide-react'

// 用户消息组件
function UserMessage({ content }: { content: string }) {
  return (
    <div className='flex justify-end'>
      <div className='bg-primary max-w-2xl rounded-lg px-4 py-2.5'>
        <p className='font-sans text-sm'>{content}</p>
      </div>
    </div>
  )
}

// 助手消息组件
function AssistantMessage({ content }: { content: string }) {
  return (
    <div className='flex justify-start'>
      <div className='max-w-3xl rounded-lg border px-4 py-2.5'>
        <pre className='font-sans text-sm whitespace-pre-line'>{content}</pre>
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
    <div className='mt-2 ml-4 max-w-3xl rounded-lg border p-3'>
      <pre className='overflow-auto text-xs'>{JSON.stringify(toolCall, null, 2)}</pre>

      {!isApproved && needsApproval && (
        <div className='mt-3 border-t pt-3'>
          <p className='mb-2 text-xs text-gray-600'>需要确认工具调用</p>
          <div className='flex gap-2'>
            <Button onClick={onApprove} className='text-sm'>
              Approve
            </Button>
            <Button onClick={onReject} className='text-sm'>
              Reject
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
      <div className='max-w-3xl rounded-lg border p-3'>
        <pre className='overflow-auto text-xs'>{JSON.stringify(content, null, 2)}</pre>
      </div>
    </div>
  )
}

// 状态提示组件
function StatusIndicator({ isFinished, isAborted }: { isFinished: boolean; isAborted: boolean }) {
  if (!isFinished && !isAborted) return null

  return (
    <div className='flex justify-center'>
      <div
        className={`rounded-full px-4 py-1.5 text-sm ${
          isFinished ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
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
      className='fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full border p-2.5 shadow-lg transition-shadow hover:shadow-xl'
      aria-label='滚动到底部'
    >
      <ArrowDown size={20} />
    </button>
  )
}

// 主聊天组件
export function Chat() {
  const params = useParams()
  const threadId = params.id!
  const [input, setInput] = useState('')
  const { send, messages, workflowState, isAborted, isFinished, abort, isRunning } =
    useWorkflowStream(threadId)

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

  const handleApprove = (toolCall: ToolCall) => {
    setApprovedCalls((prev) => new Set(prev).add(toolCall.id))
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
                  <div key={idx} className='space-y-2'>
                    <AssistantMessage content={msg.content as string} />
                    {msg.tool_calls?.map((toolCall, index) => (
                      <ToolCallItem
                        key={`${idx}-${index}`}
                        toolCall={toolCall as ToolCall}
                        isApproved={approvedToolCalls.has(toolCall.id + idx + index)}
                        needsApproval={workflowState === 'workflow-wait-human-approve'}
                        onApprove={() => handleApprove(toolCall as ToolCall)}
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
      <div className='border-t'>
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
              className='flex-1'
            />
            <Button onClick={handleSend} disabled={isRunning}>
              发送
            </Button>
            <Button onClick={abort} disabled={!isRunning}>
              中止
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
