import { useEffect, useRef, useState } from 'react'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { context } from '../../hooks/chatContenxt'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import type { ToolCall } from '@/agent/core/types'
import { ArrowDown, Send, StopCircle, User, Bot, Wrench, CheckCircle2 } from 'lucide-react'
import { useThreadStore } from '../../store/threadStore'

// 用户消息组件
function UserMessage({ content }: { content: string }) {
  return (
    <div className='flex items-start justify-end gap-3'>
      <div className='bg-primary max-w-2xl rounded-2xl rounded-tr-sm px-5 py-3 shadow-sm'>
        <p className='text-sm leading-relaxed text-white'>{content}</p>
      </div>
      <div className='bg-primary/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full'>
        <User className='text-primary h-4 w-4' />
      </div>
    </div>
  )
}

// 助手消息组件
function AssistantMessage({ content }: { content: string }) {
  return (
    <div className='flex items-start gap-3'>
      <div className='bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full'>
        <Bot className='text-primary h-4 w-4' />
      </div>
      <div className='border-border bg-background max-w-3xl rounded-2xl rounded-tl-sm border px-5 py-3 shadow-sm'>
        <pre className='text-foreground font-sans text-sm leading-relaxed whitespace-pre-line'>
          {content}
        </pre>
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
  const [isExpanded, setIsExpanded] = useState(needsApproval)

  return (
    <div className='ml-11 max-w-3xl'>
      <div className='border-border bg-background/50 overflow-hidden rounded-xl border transition-all hover:shadow-md'>
        {/* 工具调用头部 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className='hover:bg-border/30 flex w-full items-center gap-3 px-4 py-3 transition-colors'
        >
          <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/10'>
            <Wrench className='h-3.5 w-3.5 text-blue-600' />
          </div>
          <div className='flex-1 text-left'>
            <p className='text-foreground text-sm font-medium'>
              {toolCall.function?.name || 'Tool Call'}
            </p>
            <p className='text-text-secondary text-xs'>
              Click to {isExpanded ? 'collapse' : 'expand'} details
            </p>
          </div>
          <svg
            className={`text-text-secondary h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth={2}
          >
            <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
          </svg>
        </button>

        {/* 工具调用详情 */}
        {isExpanded && (
          <div className='border-border bg-primary/5 border-t px-4 py-3'>
            <pre className='bg-background text-text-secondary overflow-auto rounded-lg p-3 font-mono text-xs'>
              {JSON.stringify(toolCall, null, 2)}
            </pre>

            {!isApproved && needsApproval && (
              <div className='border-border mt-3 border-t pt-3'>
                <div className='mb-3 flex items-center gap-2'>
                  <div className='h-2 w-2 animate-pulse rounded-full bg-amber-500'></div>
                  <p className='text-text-secondary text-xs font-medium'>Approval Required</p>
                </div>
                <div className='flex gap-2'>
                  <Button
                    onClick={onApprove}
                    className='flex h-9 items-center gap-2 px-4 text-xs font-medium'
                  >
                    <CheckCircle2 className='h-3.5 w-3.5' />
                    Approve
                  </Button>
                  <Button
                    onClick={onReject}
                    className='border-border bg-background text-foreground hover:bg-border/50 flex h-9 items-center gap-2 border px-4 text-xs font-medium'
                  >
                    <svg
                      className='h-3.5 w-3.5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2}
                    >
                      <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
                    </svg>
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 工具结果组件
function ToolMessage({ content }: { content: any }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className='flex items-start gap-3'>
      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10'>
        <CheckCircle2 className='h-4 w-4 text-green-600' />
      </div>
      <div className='max-w-3xl flex-1'>
        <div className='border-border bg-background/50 overflow-hidden rounded-xl border transition-all hover:shadow-md'>
          {/* 工具结果头部 */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className='hover:bg-border/30 flex w-full items-center gap-3 px-4 py-3 transition-colors'
          >
            <div className='flex-1 text-left'>
              <p className='text-foreground text-sm font-medium'>Tool Result</p>
              <p className='text-text-secondary text-xs'>
                Click to {isExpanded ? 'collapse' : 'expand'} details
              </p>
            </div>
            <svg
              className={`text-text-secondary h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
            </svg>
          </button>

          {/* 工具结果详情 */}
          {isExpanded && (
            <div className='border-border border-t bg-green-500/5 px-4 py-3'>
              <pre className='bg-background text-text-secondary overflow-auto rounded-lg p-3 font-mono text-xs'>
                {JSON.stringify(content, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 状态提示组件
function StatusIndicator({ isFinished, isAborted }: { isFinished: boolean; isAborted: boolean }) {
  if (!isFinished && !isAborted) return null

  return (
    <div className='flex justify-center py-4'>
      <div
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium shadow-sm transition-all ${
          isFinished
            ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
            : 'bg-red-50 text-red-700 ring-1 ring-red-200'
        }`}
      >
        {isFinished ? (
          <>
            <CheckCircle2 className='h-3.5 w-3.5' />
            <span>Completed</span>
          </>
        ) : (
          <>
            <StopCircle className='h-3.5 w-3.5' />
            <span>Aborted</span>
          </>
        )}
      </div>
    </div>
  )
}

// 加载动画组件
function TypingIndicator() {
  return (
    <div className='ml-12 flex items-start gap-3'>
      <div className='flex gap-1.5'>
        <div
          className='bg-text-secondary h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '0ms' }}
        ></div>
        <div
          className='bg-text-secondary h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '150ms' }}
        ></div>
        <div
          className='bg-text-secondary h-2 w-2 animate-bounce rounded-full'
          style={{ animationDelay: '300ms' }}
        ></div>
      </div>
    </div>
  )
}

// 滚动到底部按钮
function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className='bg-background border-border hover:bg-primary/5 fixed bottom-32 left-1/2 -translate-x-1/2 rounded-full border p-3 shadow-lg transition-all hover:scale-105 hover:shadow-xl'
      aria-label='Scroll to bottom'
    >
      <ArrowDown size={18} className='text-foreground' />
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
    if (!input.trim() || isRunning) return
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
    <div className='bg-background flex h-full w-full flex-col'>
      {/* 消息区域 */}
      <div className='flex-1 overflow-auto'>
        <div className='mx-auto max-w-4xl space-y-6 px-4 py-8'>
          {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center gap-4 py-20 text-center'>
              <div className='bg-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl'>
                <Bot className='text-primary h-8 w-8' />
              </div>
              <div>
                <h3 className='text-foreground mb-1 text-lg font-semibold'>Start a conversation</h3>
                <p className='text-text-secondary text-sm'>Send a message to begin</p>
              </div>
            </div>
          )}

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

          {isRunning && messages.length > 0 && <TypingIndicator />}

          {messages.length > 0 && <StatusIndicator isFinished={isFinished} isAborted={isAborted} />}

          <div ref={placeholderRef} className='h-32' />
        </div>
      </div>

      {showToBottomButton && <ScrollToBottomButton onClick={toBottom} />}

      {/* 输入区域 */}
      <div className='border-border bg-background/80 border-t backdrop-blur-sm'>
        <div className='mx-auto max-w-4xl px-4 py-4'>
          <div className='relative'>
            {/* 渐变边框效果 */}
            <div className='from-primary/20 via-primary/10 to-primary/20 absolute -inset-0.5 rounded-2xl bg-gradient-to-r opacity-20 blur'></div>

            <div className='relative flex items-end gap-2'>
              <div className='relative flex-1'>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder='Type your message...'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  disabled={isRunning}
                  className='border-border focus:border-primary/50 resize-none rounded-xl pr-12 transition-all'
                />
              </div>

              {isRunning ? (
                <Button
                  onClick={abort}
                  className='border-border bg-background text-foreground flex h-10 shrink-0 items-center gap-2 rounded-xl border px-4 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                >
                  <StopCircle className='h-4 w-4' />
                  <span className='hidden sm:inline'>Stop</span>
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className='flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100'
                >
                  <Send className='h-4 w-4' />
                  <span className='hidden sm:inline'>Send</span>
                </Button>
              )}
            </div>
          </div>

          {/* 快捷提示 */}
          <p className='text-text-info mt-2 text-center text-xs'>
            Press <kbd className='bg-border/50 rounded px-1.5 py-0.5 font-mono'>Enter</kbd> to send,{' '}
            <kbd className='bg-border/50 rounded px-1.5 py-0.5 font-mono'>Shift + Enter</kbd> for
            new line
          </p>
        </div>
      </div>
    </div>
  )
}
