import { useState } from 'react'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { useWorkflowStream } from '../../hooks/useWorkflowStream'

export function Welcome() {
  const [input, setInput] = useState('')

  const { send, abort, messages, workflowState, isRunning, isFinished, isAborted } =
    useWorkflowStream()

  const handleSend = async () => {
    if (!input.trim()) return

    await send(input)
    setInput('')
  }

  const handleApprove = () => {
    window.ipcRendererApi.invoke('agent-human-approved')
  }

  const handleReject = () => {}

  return (
    <div className='flex h-full w-full flex-col'>
      {/* 输出区域 */}
      <div className='flex-1 space-y-3 overflow-auto p-4'>
        {messages.map((msg, idx) => {
          switch (msg.role) {
            case 'user':
              return (
                <div key={idx} className='text-right'>
                  <div className='inline-block rounded bg-blue-500 px-3 py-2 text-white'>
                    {msg.content as string}
                  </div>
                </div>
              )

            case 'assistant':
              return (
                <>
                  <div key={idx} className='text-left'>
                    <div className='inline-block rounded bg-gray-200 px-3 py-2'>
                      {msg.content as string}
                    </div>
                  </div>
                  {}
                </>
              )

            default:
              return null
          }
        })}

        {/* workflow 等待人工确认 */}
        {workflowState === 'workflow-wait-human-approve' && (
          <div className='flex gap-2'>
            <Button onClick={handleApprove}>Approve</Button>
            <Button onClick={handleReject}>Reject</Button>
          </div>
        )}

        {isFinished && <div className='text-green-500'>✅ Workflow Finished</div>}
        {isAborted && <div className='text-red-500'>⛔ Workflow Aborted</div>}
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
