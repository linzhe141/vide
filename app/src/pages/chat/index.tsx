import { useEffect, useRef, useState } from 'react'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { useParams } from 'react-router'
import { context } from '../../hooks/chatContenxt'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'
import type { ToolCall } from '@/agent/core/types'
import { ArrowDown } from 'lucide-react'

export function Chat() {
  const params = useParams()
  const threadId = params.id!
  const [input, setInput] = useState('')
  const { send, messages, workflowState, isAborted, isFinished, abort, isRunning } =
    useWorkflowStream(threadId)

  const [approvedToolCalls, setApprovedCalls] = useState<Set<string>>(new Set())

  useEffect(() => {
    const firstInput = context.firstInput
    if (firstInput) {
      console.log('firstInput', firstInput)
      context.firstInput = ''
      send(firstInput)
    }
  }, [send])

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

  const placeholerRef = useRef<HTMLDivElement>(null)
  const [showToBottomButton, setShowToBottomButton] = useState(false)

  function toBottom() {
    placeholerRef.current!.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setShowToBottomButton(!entry.isIntersecting)
        })
      },
      { threshold: 0.5 }
    )
    observer.observe(placeholerRef.current!)
    return () => {
      observer.disconnect()
    }
  }, [])
  return (
    <div className='flex h-full w-full flex-col'>
      {/* 输出区域 */}
      <div className='flex-1 space-y-3 overflow-auto p-4'>
        {messages.map((msg, idx) => {
          switch (msg.role) {
            case 'user':
              return (
                <div key={idx} className='text-right'>
                  <div className='bg-primary inline-block rounded px-3 py-2 font-sans'>
                    {msg.content as string}
                  </div>
                </div>
              )

            case 'assistant':
              return (
                <>
                  <div key={idx} className='w-[800px] text-left'>
                    <pre className='inline-block rounded px-3 py-2 font-sans whitespace-pre-line'>
                      {msg.content as string}
                    </pre>
                  </div>
                  {msg.tool_calls &&
                    msg.tool_calls.length > 0 &&
                    msg.tool_calls.map((toolCall, index) => (
                      <div>
                        <pre>{JSON.stringify(toolCall, null, 2)}</pre>
                        {/* workflow 等待人工确认 */}
                        {!approvedToolCalls.has(toolCall.id + idx + index) &&
                          workflowState === 'workflow-wait-human-approve' && (
                            <div className='gap-2'>
                              <div className='text-xs'>存在工具调用 是否 approve？</div>

                              <div className='mt-2 flex gap-2'>
                                <Button onClick={() => handleApprove(toolCall as ToolCall)}>
                                  Approve
                                </Button>
                                <Button onClick={handleReject}>Reject</Button>
                              </div>
                            </div>
                          )}
                      </div>
                    ))}
                </>
              )
            case 'tool':
              return (
                <div key={idx}>
                  <pre className='bg-primary inline-block rounded px-3 py-2 font-sans'>
                    {JSON.stringify(msg, null, 2)}
                  </pre>
                </div>
              )
            default:
              return null
          }
        })}

        {messages.length > 0 && isFinished && (
          <div className='text-green-500'>✅ Workflow Finished</div>
        )}
        {messages.length > 0 && isAborted && (
          <div className='text-red-500'>⛔ Workflow Aborted</div>
        )}

        {showToBottomButton && (
          <span
            className='fixed bottom-10 left-1/2 z-100 -translate-x-1/2 cursor-pointer rounded-full border-1 border-gray-300 bg-gray-50 p-2 text-black shadow-xl hover:shadow-2xl'
            onClick={toBottom}
          >
            <ArrowDown></ArrowDown>
          </span>
        )}
        <div ref={placeholerRef} className='h-[200px]'></div>
      </div>

      {/* 输入区域 */}
      <div className='flex gap-2 border-t p-3'>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Type your message...'
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
        />
        <Button onClick={handleSend} disabled={isRunning}>
          Send
        </Button>
        <Button onClick={abort} disabled={!isRunning}>
          Abort
        </Button>
      </div>
    </div>
  )
}
