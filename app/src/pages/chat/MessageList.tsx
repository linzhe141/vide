import { useState } from 'react'
import { useThreadStore, type ConversationBlock } from '../../store/threadStore'

type Message = ConversationBlock['messages'][number]

function UserMessage({ content }: { content: string }) {
  return (
    <div className='flex justify-end'>
      <div className='bg-primary max-w-[70%] rounded-2xl px-4 py-3 text-sm text-white shadow-sm'>
        <pre className='font-sans whitespace-pre-wrap'>{content}</pre>
      </div>
    </div>
  )
}

function AssistantText({ content }: { content: string }) {
  return (
    <div className='flex justify-start'>
      <div className='w-full max-w-[720px] text-sm leading-relaxed'>
        <pre className='font-sans whitespace-pre-wrap'>{content}</pre>
      </div>
    </div>
  )
}

function ReasoningView({ content }: { content: string }) {
  const [open, setOpen] = useState(false)

  if (!content) return null

  return (
    <div className='flex justify-start'>
      <div className='w-full max-w-[720px]'>
        <button
          onClick={() => setOpen(!open)}
          className='text-text-info mb-2 flex items-center gap-2 text-xs hover:underline'
        >
          {open ? '▼' : '▶'} reasoning
        </button>

        {open && (
          <div className='bg-background border-border text-text-secondary rounded-lg border p-3 text-xs'>
            <pre className='font-sans whitespace-pre-wrap'>{content}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallView({ message }: { message: Extract<Message, { role: 'tool-call' }> }) {
  return (
    <div className='flex justify-start'>
      <div className='bg-background border-border w-full max-w-[720px] rounded-xl border p-4 shadow-sm'>
        <div className='text-text-info mb-3 text-xs font-semibold'>Tool Call</div>

        <div className='space-y-3'>
          {message.toolCalls.map((tool) => (
            <div key={tool.id} className='border-border rounded-lg border p-3'>
              <div className='font-mono text-xs font-semibold'>{tool.function.name}</div>

              {tool.function.arguments && (
                <pre className='text-text-secondary mt-2 text-xs whitespace-pre-wrap'>
                  {tool.function.arguments}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolResultView({ message }: { message: Extract<Message, { role: 'tool-result' }> }) {
  return (
    <div className='flex justify-start'>
      <div className='border-border bg-background w-full max-w-[720px] rounded-xl border p-4 shadow-sm'>
        <div className='text-text-info mb-2 text-xs font-semibold'>Tool Result</div>

        <pre className='text-text-secondary text-xs whitespace-pre-wrap'>
          {typeof message.result === 'string'
            ? message.result
            : JSON.stringify(message.result, null, 2)}
        </pre>
      </div>
    </div>
  )
}

function ErrorView({ error }: { error: unknown }) {
  return (
    <div className='flex justify-start'>
      <div className='w-full max-w-[720px] rounded-xl border border-red-400 bg-red-50 p-4 text-xs text-red-600 dark:bg-red-950'>
        <div className='mb-2 font-semibold'>Error</div>

        <pre className='whitespace-pre-wrap'>
          {typeof error === 'string' ? error : JSON.stringify(error, null, 2)}
        </pre>
      </div>
    </div>
  )
}

function MessageView({ message }: { message: Message }) {
  switch (message.role) {
    case 'assistant-text':
      return <AssistantText content={message.content} />

    case 'assistant-reason':
      return <ReasoningView content={message.content} />

    case 'tool-call':
      return <ToolCallView message={message} />

    case 'tool-result':
      return <ToolResultView message={message} />

    case 'error':
      return <ErrorView error={message.error} />

    default:
      return null
  }
}
function PlanExecutionList({ block }: { block: ConversationBlock }) {
  if (!block.planner) return null

  const planner = block.planner

  const messages = block.messages.filter((m) => m.role !== 'user')

  const stepCount = planner.plans.length

  const stepSize = stepCount ? Math.ceil(messages.length / stepCount) : 0

  const steps = planner.plans.map((plan, i) => ({
    plan,
    messages: messages.slice(i * stepSize, (i + 1) * stepSize),
  }))

  return (
    <div className='flex justify-start'>
      <div className='w-full max-w-[720px]'>
        <div className='space-y-6'>
          {steps.map((step, i) => {
            const active = planner.status === 'running' && i === steps.length - 1

            return (
              <div key={i} className='flex gap-4'>
                {/* timeline */}
                <div className='flex flex-col items-center'>
                  <div className={`h-3 w-3 rounded-full ${active ? 'bg-primary' : 'bg-border'}`} />

                  {i !== steps.length - 1 && <div className='bg-border mt-1 w-[2px] flex-1' />}
                </div>

                {/* step */}
                <div className='flex-1 space-y-4'>
                  <div className='border-border bg-background rounded-xl border p-4 shadow-sm'>
                    <div className='text-xs font-semibold'>Step {i + 1}</div>

                    <pre className='text-text-secondary mt-1 text-xs whitespace-pre-wrap'>
                      {JSON.stringify(step.plan)}
                    </pre>
                  </div>

                  {/* step messages */}
                  {step.messages.map((msg, j) => (
                    <MessageView key={j} message={msg} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ExecutionStream({ block }: { block: ConversationBlock }) {
  if (!block.messages.length) return null

  return (
    <div className='space-y-4'>
      {block.messages
        .filter((m) => m.role !== 'user')
        .map((msg, i) => (
          <MessageView key={i} message={msg} />
        ))}
    </div>
  )
}

function BlockView({ block }: { block: ConversationBlock }) {
  return (
    <div className='space-y-8 py-10'>
      <UserMessage content={block.input} />

      {block.planner ? <PlanExecutionList block={block} /> : <ExecutionStream block={block} />}

      {block.status === 'running' && <div className='text-text-secondary text-xs'>thinking…</div>}
    </div>
  )
}

export function MessageList({ loading }: { loading: boolean }) {
  const blocks = useThreadStore((s) => s.blocks)

  return (
    <div className='flex w-full justify-center'>
      <div className='w-full max-w-3xl px-6 py-12'>
        {blocks.length === 0 && !loading && (
          <div className='text-text-secondary mt-24 text-center text-sm'>Start a conversation</div>
        )}

        <div className='divide-border divide-y'>
          {blocks.map((block) => (
            <BlockView key={block.id} block={block} />
          ))}
        </div>

        {loading && <div className='text-text-secondary mt-6 text-xs'>Loading…</div>}
      </div>
    </div>
  )
}
