import { useThreadStore, type ConversationBlock } from '../../store/threadStore'

export function MessageList({ loading }: { loading: boolean }) {
  const blocks = useThreadStore((s) => s.blocks)

  return (
    <div className='mx-auto w-full max-w-3xl space-y-10 px-4 py-10'>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </div>
  )
}

/* -------------------------------- block -------------------------------- */

function BlockView({ block }: { block: ConversationBlock }) {
  const Taget = block.type === 'normal' ? NormalBlockView : PlanBlockView
  const status = block.status
  return (
    <div>
      <Taget block={block} />
      {status === 'in_analyzeing' && (
        <div className='text-text-secondary animate-pulse text-sm'>analyzeing user input...</div>
      )}
    </div>
  )
}

/* -------------------------------- normal -------------------------------- */

function NormalBlockView({ block }: any) {
  return (
    <div className='space-y-4'>
      {block.messages.map((m: any, i: number) => (
        <MessageView key={i} message={m} />
      ))}
    </div>
  )
}

/* -------------------------------- plan -------------------------------- */

function PlanBlockView({ block }: any) {
  return (
    <div className='space-y-8'>
      {/* user input */}
      <div className='flex justify-end'>
        <div className='bg-primary/10 max-w-[80%] rounded-lg px-4 py-2 text-sm'>{block.input}</div>
      </div>

      {/* plan steps */}
      <div className='border-border space-y-8 border-l pl-6'>
        {block.steps.map((step: any) => (
          <StepView key={step.id} step={step} />
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- step -------------------------------- */

function StepView({ step }: any) {
  return (
    <div className='relative space-y-3'>
      {/* timeline dot */}
      <div className='bg-primary absolute top-1 -left-[11px] h-2 w-2 rounded-full'></div>

      {/* step title */}
      <div className='text-text-secondary text-sm font-medium'>{step.title}</div>

      {/* workflow messages */}
      {step.workflow && (
        <div className='space-y-4'>
          {step.workflow.messages.map((m: any, i: number) => (
            <MessageView key={i} message={m} />
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------------------- message -------------------------------- */

function MessageView({ message }: any) {
  switch (message.role) {
    case 'user':
      return (
        <div className='flex justify-end'>
          <div className='bg-primary/10 max-w-[80%] rounded-lg px-4 py-2 text-sm'>
            {message.content}
          </div>
        </div>
      )

    case 'assistant-text':
      return <pre className='prose prose-sm dark:prose-invert max-w-none'>{message.content}</pre>

    case 'assistant-reason':
      return (
        <details className='text-text-secondary border-border rounded-md border p-2 text-xs'>
          <summary className='cursor-pointer select-none'>Reasoning</summary>

          <pre className='mt-2 text-xs whitespace-pre-wrap'>{message.content}</pre>
        </details>
      )

    case 'tool-call':
      return (
        <div className='border-border bg-background rounded-md border p-3 text-xs'>
          <div className='text-text-info mb-1'>Tool Call</div>

          <pre className='overflow-auto'>{JSON.stringify(message.toolCalls, null, 2)}</pre>
        </div>
      )

    case 'tool-result':
      return (
        <div className='border-border bg-background rounded-md border p-3 text-xs'>
          <div className='text-text-info mb-1'>Tool Result</div>

          <pre className='overflow-auto'>{JSON.stringify(message.result, null, 2)}</pre>
        </div>
      )

    case 'error':
      return <div className='text-sm text-red-500'>{String(message.error)}</div>

    default:
      return null
  }
}
