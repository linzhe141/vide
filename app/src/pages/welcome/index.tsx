import { useEffect, useState } from 'react'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'

export function Welcome() {
  const [input, setInput] = useState('')
  const [hasFirstInput, setHasFirstInput] = useState(false)

  const [workflowResponse, setWorkflowResponse] = useState('')

  useEffect(() => {
    const remove1 = window.ipcRendererApi.on('agent-workflow-start', () => {})
    const remove2 = window.ipcRendererApi.on('agent-llm-delta', (content) => {
      setWorkflowResponse(content)
    })
    const remove3 = window.ipcRendererApi.on('agent-llm-tool-calls', (data) => {
      setWorkflowResponse((prev) => `${prev}\n${JSON.stringify(data, null, 4)}\n`)
    })
    return () => {
      remove1()
      remove2()
      remove3()
    }
  })

  return (
    <div className='flex h-full w-full flex-col'>
      {/* 输出区域 */}
      <div className='flex-1 overflow-auto p-4'>
        <div className='h-full w-full rounded-lg border shadow-inner'>
          <pre className='h-full w-full overflow-auto p-4 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-zinc-100'>
            {workflowResponse}
          </pre>
        </div>
      </div>

      {/* 输入区域 */}
      <div className='border-t p-3'>
        <div className='flex items-center gap-3'>
          <Input value={input} onChange={(e) => setInput(e.target.value)} />
          <Button
            onClick={async () => {
              if (!hasFirstInput) {
                setHasFirstInput(true)
                await window.ipcRendererApi.invoke('agent-create-session')
              }
              window.ipcRendererApi.invoke('agent-session-send', { input })
            }}
          >
            send
          </Button>
        </div>
      </div>
    </div>
  )
}
